/**
 * @fileoverview Servicio de Actualizacion de Estado en Plataformas de Delivery
 *
 * Servicio encargado de enviar actualizaciones de estado de pedidos a las
 * plataformas de delivery externas. Cuando el restaurante cambia el estado
 * de un pedido internamente (ej: marca como listo para retiro), este servicio
 * notifica a la plataforma correspondiente para que el cliente y el repartidor
 * vean el progreso actualizado.
 *
 * FLUJO:
 * 1. El restaurante actualiza el estado en el POS
 * 2. Se llama a notifyStatusChange() con el nuevo estado
 * 3. El servicio busca la orden y verifica si es de delivery externo
 * 4. Mapea el estado interno al formato de la plataforma
 * 5. Envia la actualizacion via el adaptador correspondiente
 *
 * @module integrations/delivery/sync/statusUpdate.service
 */

import { prisma } from '../../../lib/prisma';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { logger } from '../../../utils/logger';
import { NotFoundError } from '../../../utils/errors';
import { NormalizedOrderStatus, type StatusUpdateResult } from '../types/normalized.types';

// ============================================================================
// MAPEO DE ESTADOS INTERNOS A NORMALIZADOS
// ============================================================================

/**
 * Mapeo de estados internos del POS a estados normalizados de delivery.
 * Se usa para traducir el estado interno al formato que entienden las plataformas.
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
// SERVICIO DE ACTUALIZACION DE ESTADO
// ============================================================================

class StatusUpdateService {
  /**
   * Notifica a la plataforma externa sobre un cambio de estado en un pedido.
   * Solo actua si el pedido es de delivery externo (tiene deliveryPlatformId y externalId).
   *
   * @param orderId - ID interno de la orden
   * @param newStatus - Nuevo estado interno del pedido
   * @returns Resultado del envio, o null si no es pedido de delivery externo
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

    // Si no es un pedido de delivery externo, no hay nada que notificar
    if (!order || !order.deliveryPlatformId || !order.externalId) {
      return null;
    }

    // Mapear estado interno al formato normalizado
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
   * Marca un pedido como listo para retiro y notifica a la plataforma.
   * Actualiza el estado interno a PREPARED y envia la notificacion.
   */
  async markAsReady(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PREPARED' },
    });

    return this.notifyStatusChange(orderId, 'PREPARED');
  }

  /**
   * Marca un pedido como en preparacion y notifica a la plataforma.
   * Actualiza el estado interno a IN_PREPARATION y envia la notificacion.
   */
  async markAsInPreparation(orderId: number): Promise<StatusUpdateResult | null> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'IN_PREPARATION' },
    });

    return this.notifyStatusChange(orderId, 'IN_PREPARATION');
  }

  /**
   * Cancela un pedido internamente y notifica a la plataforma externa.
   * Si es un pedido de delivery externo, envia la cancelacion (rechazo)
   * al adaptador correspondiente.
   */
  async cancelOrder(orderId: number, reason?: string): Promise<StatusUpdateResult | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryPlatform: true },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId}`);
    }

    // Actualizar el estado en la base de datos local
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        closedAt: new Date(),
      },
    });

    // Si es un pedido externo, notificar a la plataforma
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
