/**
 * @fileoverview Status Update Service
 * 
 * Servicio para enviar actualizaciones de estado de pedidos a plataformas de delivery.
 * 
 * Cuando el restaurante actualiza el estado de un pedido (ej: listo para recoger),
 * este servicio notifica a la plataforma correspondiente.
 * 
 * @module integrations/delivery/sync/statusUpdate.service
 */

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { logger } from '../../../utils/logger';
import { NormalizedOrderStatus, type StatusUpdateResult } from '../types/normalized.types';

// ============================================================================
// MAPEO DE ESTADOS
// ============================================================================

/**
 * Mapeo de estados internos a estados normalizados de delivery.
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
   * Notifica a la plataforma externa sobre un cambio de estado.
   * 
   * @param orderId - ID del pedido interno
   * @param newStatus - Nuevo estado interno
   * @returns Resultado de la actualización
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

    // Si no es un pedido de delivery externo, no hay nada que hacer
    if (!order || !order.deliveryPlatformId || !order.externalId) {
      return null;
    }

    // Mapear estado interno a normalizado
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
   * Marca un pedido como listo para recoger y notifica a la plataforma.
   */
  async markAsReady(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PREPARED' },
    });

    return this.notifyStatusChange(orderId, 'PREPARED');
  }

  /**
   * Marca un pedido como en preparación y notifica a la plataforma.
   */
  async markAsInPreparation(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'IN_PREPARATION' },
    });

    return this.notifyStatusChange(orderId, 'IN_PREPARATION');
  }

  /**
   * Cancela un pedido y notifica a la plataforma.
   */
  async cancelOrder(orderId: number, reason?: string): Promise<StatusUpdateResult | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryPlatform: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Actualizar en DB
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        closedAt: new Date(),
      },
    });

    // Si es pedido externo, notificar a la plataforma
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
