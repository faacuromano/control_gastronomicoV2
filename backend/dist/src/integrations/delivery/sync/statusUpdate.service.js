"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusUpdateService = void 0;
const prisma_1 = require("../../../lib/prisma");
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const logger_1 = require("../../../utils/logger");
const normalized_types_1 = require("../types/normalized.types");
// ============================================================================
// MAPEO DE ESTADOS
// ============================================================================
/**
 * Mapeo de estados internos a estados normalizados de delivery.
 */
const INTERNAL_TO_NORMALIZED_STATUS = {
    'OPEN': normalized_types_1.NormalizedOrderStatus.NEW,
    'CONFIRMED': normalized_types_1.NormalizedOrderStatus.ACCEPTED,
    'IN_PREPARATION': normalized_types_1.NormalizedOrderStatus.IN_PREPARATION,
    'PREPARED': normalized_types_1.NormalizedOrderStatus.READY,
    'ON_ROUTE': normalized_types_1.NormalizedOrderStatus.ON_ROUTE,
    'DELIVERED': normalized_types_1.NormalizedOrderStatus.DELIVERED,
    'CANCELLED': normalized_types_1.NormalizedOrderStatus.CANCELLED,
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
    async notifyStatusChange(orderId, newStatus) {
        const order = await prisma_1.prisma.order.findUnique({
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
            logger_1.logger.warn('Unknown internal status for mapping', {
                orderId,
                internalStatus: newStatus,
            });
            return null;
        }
        try {
            const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformId(order.deliveryPlatformId);
            const result = await adapter.updateOrderStatus(order.externalId, normalizedStatus);
            logger_1.logger.info('Order status sent to platform', {
                orderId,
                externalId: order.externalId,
                platformCode: order.deliveryPlatform?.code,
                newStatus: normalizedStatus,
                success: result.success,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to send status update to platform', {
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
    async markAsReady(orderId) {
        await prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { status: 'PREPARED' },
        });
        return this.notifyStatusChange(orderId, 'PREPARED');
    }
    /**
     * Marca un pedido como en preparación y notifica a la plataforma.
     */
    async markAsInPreparation(orderId) {
        await prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { status: 'IN_PREPARATION' },
        });
        return this.notifyStatusChange(orderId, 'IN_PREPARATION');
    }
    /**
     * Cancela un pedido y notifica a la plataforma.
     */
    async cancelOrder(orderId, reason) {
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { deliveryPlatform: true },
        });
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }
        // Actualizar en DB
        await prisma_1.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                closedAt: new Date(),
            },
        });
        // Si es pedido externo, notificar a la plataforma
        if (order.externalId && order.deliveryPlatformId) {
            try {
                const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformId(order.deliveryPlatformId);
                await adapter.rejectOrder(order.externalId, reason || 'Cancelled by restaurant');
                return {
                    success: true,
                    externalId: order.externalId,
                    newStatus: normalized_types_1.NormalizedOrderStatus.CANCELLED,
                };
            }
            catch (error) {
                logger_1.logger.error('Failed to cancel order in platform', {
                    orderId,
                    externalId: order.externalId,
                    error: error instanceof Error ? error.message : String(error),
                });
                return {
                    success: false,
                    externalId: order.externalId,
                    newStatus: normalized_types_1.NormalizedOrderStatus.CANCELLED,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }
        return null;
    }
}
exports.statusUpdateService = new StatusUpdateService();
//# sourceMappingURL=statusUpdate.service.js.map