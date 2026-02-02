/**
 * @fileoverview Servicio de Kitchen Display System (KDS) - Comunicacion en Tiempo Real
 *
 * Gestiona la transmision de eventos en tiempo real hacia las pantallas de cocina
 * y meseros a traves de Socket.IO. Cada evento esta aislado por tenant usando
 * rooms con formato `tenant:{id}:kitchen`.
 *
 * Este servicio NO persiste datos; solo actua como puente entre la logica de negocio
 * y los clientes WebSocket conectados.
 *
 * Eventos emitidos:
 * - kitchen:order_new    -> Nueva orden para la cocina
 * - kitchen:order_update -> Actualizacion de estado de orden
 * - order:new / order:update -> Eventos legacy para compatibilidad hacia atras
 * - waiter:order_ready   -> Notifica a meseros que una orden esta lista para retirar
 * - kitchen:alert        -> Alertas genericas para cocina
 *
 * @module services/kds.service
 */

import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';

/** Estructura minima de orden que necesita el KDS para broadcasting */
interface KDSOrder {
    id: number;
    tenantId: number;
    orderNumber: number;
    status?: string;
    tableId?: number | null;
    items?: unknown[];
    [key: string]: unknown;
}

export class KDSService {
    /**
     * Calcula el tiempo estimado de preparacion en minutos.
     * Usa una formula basica: 10 minutos base + 2 minutos por item.
     * En el futuro se podria obtener tiempos especificos por producto desde la BD.
     */
    calculatePrepTime(items: unknown[]): number {
        // Tiempo base (10m) + 2m por cada item
        // Futuro: obtener tiempos especificos desde la BD por producto
        return 10 + (items.length * 2);
    }

    /**
     * Transmite una nueva orden a la cocina (aislado por tenant).
     * El objeto order DEBE incluir tenantId para el ruteo correcto del evento.
     *
     * Emite dos eventos: el nuevo (kitchen:order_new) y el legacy (order:new)
     * para mantener compatibilidad con clientes anteriores.
     */
    broadcastNewOrder(order: KDSOrder) {
        try {
            const io = getIO();
            if (!io) return;

            if (!order.tenantId) {
                logger.error('broadcastNewOrder called without tenantId on order', { orderId: order.id });
                return;
            }

            const tenantId = order.tenantId;
            const prepTime = this.calculatePrepTime(order.items || []);

            const payload = {
                ...order,
                estimatedPrepTime: prepTime,
                timestamp: new Date()
            };

            // 1. Notificar a la cocina general (aislado por tenant)
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);

            // 2. Evento legacy para compatibilidad hacia atras con clientes antiguos
            io.to(`tenant:${tenantId}:kitchen`).emit('order:new', payload);

            logger.info('Broadcasted new order to kitchen', {
                orderNumber: order.orderNumber,
                tenantId,
                prepTime
            });
        } catch (error) {
            // ERR-007: Loggear con contexto completo de la orden para recuperacion manual
            logger.error('KDS_BROADCAST_FAILED', {
                event: 'order_new',
                orderId: order.id,
                orderNumber: order.orderNumber,
                tenantId: order.tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Transmite una actualizacion de orden a la cocina (aislado por tenant).
     * El objeto order DEBE incluir tenantId para el ruteo correcto.
     *
     * Si la orden esta PREPARADA y tiene mesa asignada, tambien notifica
     * a los meseros para que retiren el pedido.
     */
    broadcastOrderUpdate(order: KDSOrder) {
        try {
            const io = getIO();
            if (!io) return;

            if (!order.tenantId) {
                logger.error('broadcastOrderUpdate called without tenantId on order', { orderId: order.id });
                return;
            }

            const tenantId = order.tenantId;

            // Notificar a la cocina (aislado por tenant)
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_update', order);
            io.to(`tenant:${tenantId}:kitchen`).emit('order:update', order); // Evento legacy

            // Si la orden esta PREPARADA y tiene mesa, notificar a meseros que esta lista para retirar
            if (order.status === 'PREPARED' && order.tableId) {
                io.to(`tenant:${tenantId}:waiters`).emit('waiter:order_ready', {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    tableId: order.tableId
                });
            }

            logger.info('Broadcasted order update', {
                orderNumber: order.orderNumber,
                status: order.status,
                tenantId
            });
        } catch (error) {
            // ERR-007: Loggear con contexto completo de la orden para recuperacion manual
            logger.error('KDS_BROADCAST_FAILED', {
                event: 'order_update',
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                tenantId: order.tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Envia una alerta generica a la cocina (aislado por tenant).
     * Util para notificaciones de stock bajo, problemas de impresora, etc.
     */
    sendAlert(tenantId: number, message: string, level: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') {
        try {
            const io = getIO();
            if (!io) return;
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:alert', { message, level, timestamp: new Date() });
        } catch (error) {
            logger.warn('Failed to send alert', { error });
        }
    }
}

export const kdsService = new KDSService();
