/**
 * @fileoverview Status Update Service
 *
 * Service to send order status updates to delivery platforms.
 *
 * When the restaurant updates an order's status (e.g., ready for pickup),
 * this service notifies the corresponding platform.
 *
 * @module integrations/delivery/sync/statusUpdate.service
 */

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { logger } from '../../../utils/logger';
import { NotFoundError } from '../../../utils/errors';
import { NormalizedOrderStatus, type StatusUpdateResult } from '../types/normalized.types';

// ============================================================================
// MAPEO DE ESTADOS
// ============================================================================

/**
 * Internal status to normalized delivery status mapping.
 */
const INTERNAL_TO_NORMALIZED_STATUS: Record<string, NormalizedOrderStatus> = {
  'OPEN': NormalizedOrderStatus.NEW,
  'CONFIRMED': NormalizedOrderStatus.ACCEPTED,
  'IN_PREPARATION': NormalizedOrderStatus.IN_PREPARATION,
  'PREPARED': NormalizedOrderStatus.READY,
  'ON_ROUTE': NormalizedOrderStatus.ON_ROUTE,
  'DELIVERED': NormalizedOrderStatus.DELIVERED,
  'CANCELLED': NormalizedOrderStatus.CANCELLED,
};

// ============================================================================
// SERVICIO
// ============================================================================

class StatusUpdateService {
  /**
   * Notifies the external platform about a status change.
   *
   * @param orderId - Internal order ID
   * @param newStatus - New internal status
   * @returns Update result
   */
  async notifyStatusChange(
    orderId: number,
    newStatus: string
  ): Promise<StatusUpdateResult | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryPlatform: true,
      },
    });

    // If not an external delivery order, nothing to do
    if (!order || !order.deliveryPlatformId || !order.externalId) {
      return null;
    }

    // Map internal status to normalized
    const normalizedStatus = INTERNAL_TO_NORMALIZED_STATUS[newStatus];

    if (!normalizedStatus) {
      logger.warn('Unknown internal status for mapping', {
        orderId,
        internalStatus: newStatus,
      });
      return null;
    }

    try {
      const adapter = await AdapterFactory.getByPlatformId(order.deliveryPlatformId);
      
      const result = await adapter.updateOrderStatus(
        order.externalId,
        normalizedStatus
      );

      logger.info('Order status sent to platform', {
        orderId,
        externalId: order.externalId,
        platformCode: order.deliveryPlatform?.code,
        newStatus: normalizedStatus,
        success: result.success,
      });

      return result;

    } catch (error) {
      logger.error('Failed to send status update to platform', {
        orderId,
        externalId: order.externalId,
        platformId: order.deliveryPlatformId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        externalId: order.externalId,
        newStatus: normalizedStatus,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Marks an order as ready for pickup and notifies the platform.
   */
  async markAsReady(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PREPARED' },
    });

    return this.notifyStatusChange(orderId, 'PREPARED');
  }

  /**
   * Marks an order as in preparation and notifies the platform.
   */
  async markAsInPreparation(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'IN_PREPARATION' },
    });

    return this.notifyStatusChange(orderId, 'IN_PREPARATION');
  }

  /**
   * Cancels an order and notifies the platform.
   */
  async cancelOrder(orderId: number, reason?: string): Promise<StatusUpdateResult | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryPlatform: true },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId}`);
    }

    // Update in DB
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        closedAt: new Date(),
      },
    });

    // If external order, notify the platform
    if (order.externalId && order.deliveryPlatformId) {
      try {
        const adapter = await AdapterFactory.getByPlatformId(order.deliveryPlatformId);
        await adapter.rejectOrder(order.externalId, reason || 'Cancelled by restaurant');

        return {
          success: true,
          externalId: order.externalId,
          newStatus: NormalizedOrderStatus.CANCELLED,
        };
      } catch (error) {
        logger.error('Failed to cancel order in platform', {
          orderId,
          externalId: order.externalId,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          externalId: order.externalId,
          newStatus: NormalizedOrderStatus.CANCELLED,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return null;
  }
}

export const statusUpdateService = new StatusUpdateService();
