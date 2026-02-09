/**
 * @fileoverview Servicio de Kitchen Display System (KDS) - Comunicacion en Tiempo Real
 *
 * Gestiona la transmision de eventos en tiempo real hacia las pantallas de cocina
 * y meseros a traves de Socket.IO. Cada evento esta aislado por tenant usando
 * rooms con formato `tenant:{id}:kitchen` o `tenant:{id}:kitchen:{stationCode}`.
 *
 * Este servicio NO persiste datos; solo actua como puente entre la logica de negocio
 * y los clientes WebSocket conectados.
 *
 * Eventos emitidos:
 * - kitchen:order_new    -> Nueva orden para la cocina
 * - kitchen:order_update -> Actualizacion de estado de orden
 * - kitchen:items_new    -> Nuevos items para una estacion especifica
 * - order:new / order:update -> Eventos legacy para compatibilidad hacia atras
 * - waiter:order_ready   -> Notifica a meseros que una orden esta lista para retirar
 * - kitchen:alert        -> Alertas genericas para cocina
 *
 * Rooms de Socket.IO:
 * - tenant:{id}:kitchen              -> Cocina general (recibe todo)
 * - tenant:{id}:kitchen:{stationCode} -> Estacion especifica (ej: BAR, COLD)
 *
 * @module services/kds.service
 */

import { getIO } from '../lib/socket';
import { logger } from '../utils/logger';
import { kdsStationService } from './kdsStation.service';

/** Estructura minima de orden que necesita el KDS para broadcasting */
interface KDSOrder {
    id: number;
    tenantId: number;
    orderNumber: number;
    status?: string;
    tableId?: number | null;
    table?: { name: string } | null;
    items?: KDSOrderItem[];
    [key: string]: unknown;
}

/** Item de orden con info de producto para resolver estacion */
interface KDSOrderItem {
    id: number;
    productId: number;
    product?: {
        id: number;
        name: string;
        kdsStationId?: number | null;
        kdsStation?: { id: number; code: string; name: string } | null;
        category?: {
            kdsStationId?: number | null;
            kdsStation?: { id: number; code: string; name: string } | null;
        };
    };
    [key: string]: unknown;
}

/** Estructura de items agrupados por estacion KDS */
interface KDSStationItems {
    orderId: number;
    orderNumber: number;
    tenantId: number;
    tableId?: number | null | undefined;
    tableName?: string | null;
    stationCode: string;
    items: unknown[];
    timestamp: Date;
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

    /**
     * Transmite nuevos items a una estacion KDS especifica.
     * Usado cuando se agregan items a una orden y cada item va a una estacion diferente.
     *
     * Emite a la room especifica de la estacion: tenant:{id}:kitchen:station:{stationCode}
     * Tambien emite a la cocina general para que vea todo.
     */
    broadcastItemsToStation(payload: KDSStationItems) {
        try {
            const io = getIO();
            if (!io) return;

            const { tenantId, stationCode } = payload;

            // 1. Emitir a la estacion especifica (room: tenant:{id}:kitchen:station:{code})
            io.to(`tenant:${tenantId}:kitchen:station:${stationCode}`).emit('kitchen:items_new', payload);

            // 2. Tambien emitir a la cocina general para pantallas que muestran todo
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:items_new', payload);

            logger.info('Broadcasted items to KDS station', {
                orderNumber: payload.orderNumber,
                stationCode,
                itemCount: payload.items.length,
                tenantId
            });
        } catch (error) {
            logger.error('KDS_STATION_BROADCAST_FAILED', {
                event: 'items_new',
                stationCode: payload.stationCode,
                orderId: payload.orderId,
                tenantId: payload.tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Transmite actualizacion de item a una estacion KDS especifica.
     * Usado cuando un item cambia de estado (PENDING -> COOKING -> READY -> SERVED).
     */
    broadcastItemUpdateToStation(
        tenantId: number,
        stationCode: string,
        itemUpdate: { itemId: number; orderId: number; orderNumber: number; status: string }
    ) {
        try {
            const io = getIO();
            if (!io) return;

            const payload = {
                ...itemUpdate,
                stationCode,
                timestamp: new Date()
            };

            // Emitir a la estacion especifica (room: tenant:{id}:kitchen:station:{code})
            io.to(`tenant:${tenantId}:kitchen:station:${stationCode}`).emit('kitchen:item_update', payload);

            // Tambien a la cocina general
            io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:item_update', payload);

            logger.debug('Broadcasted item update to KDS station', {
                itemId: itemUpdate.itemId,
                stationCode,
                status: itemUpdate.status,
                tenantId
            });
        } catch (error) {
            logger.error('KDS_ITEM_UPDATE_BROADCAST_FAILED', {
                stationCode,
                itemId: itemUpdate.itemId,
                tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Genera el nombre de la room de Socket.IO para una estacion KDS.
     * Formato: tenant:{tenantId}:kitchen:station:{stationCode}
     */
    getStationRoom(tenantId: number, stationCode: string): string {
        return `tenant:${tenantId}:kitchen:station:${stationCode}`;
    }

    /**
     * Genera el nombre de la room general de cocina.
     */
    getKitchenRoom(tenantId: number): string {
        return `tenant:${tenantId}:kitchen`;
    }

    /**
     * Transmite una nueva orden al KDS con ruteo por estacion.
     * Agrupa los items por estacion y envia a cada room especifica.
     * Tambien envia a la cocina general para pantallas "Todos".
     */
    async broadcastNewOrderWithStations(order: KDSOrder) {
        try {
            const io = getIO();
            if (!io) {
                logger.warn('[KDS] Socket.IO not available, skipping broadcast');
                return;
            }

            logger.info('[KDS] broadcastNewOrderWithStations called', {
                orderId: order.id,
                orderNumber: order.orderNumber,
                tenantId: order.tenantId,
                itemCount: order.items?.length || 0
            });

            if (!order.tenantId) {
                logger.error('broadcastNewOrderWithStations called without tenantId', { orderId: order.id });
                return;
            }

            const tenantId = order.tenantId;
            const items = order.items || [];

            if (items.length === 0) {
                logger.debug('Order has no items, skipping KDS broadcast', { orderId: order.id });
                return;
            }

            // Obtener la estacion default del tenant
            const defaultStation = await kdsStationService.getDefaultStation(tenantId);
            const defaultCode = defaultStation?.code ?? 'KITCHEN';

            // Agrupar items por estacion
            const itemsByStation = new Map<string, KDSOrderItem[]>();

            for (const item of items) {
                // Resolver estacion: producto > categoria > default
                let stationCode = defaultCode;

                if (item.product?.kdsStation?.code) {
                    stationCode = item.product.kdsStation.code;
                } else if (item.product?.category?.kdsStation?.code) {
                    stationCode = item.product.category.kdsStation.code;
                }

                const existing = itemsByStation.get(stationCode) || [];
                existing.push(item);
                itemsByStation.set(stationCode, existing);
            }

            const prepTime = this.calculatePrepTime(items);
            const timestamp = new Date();

            // Enviar a cada estacion especifica
            for (const [stationCode, stationItems] of itemsByStation) {
                const stationPayload: KDSStationItems = {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    tenantId,
                    tableId: order.tableId,
                    tableName: order.table?.name ?? null,
                    stationCode,
                    items: stationItems,
                    timestamp
                };

                const stationRoom = `tenant:${tenantId}:kitchen:station:${stationCode}`;
                logger.info(`[KDS] Emitting kitchen:items_new to room: ${stationRoom}`, {
                    orderNumber: order.orderNumber,
                    stationCode,
                    itemCount: stationItems.length
                });

                // Emitir a la estacion especifica
                io.to(stationRoom).emit('kitchen:items_new', stationPayload);

                // También emitir a la cocina general para que reciba todas las estaciones
                io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:items_new', stationPayload);
            }

            // Enviar orden completa a la cocina general (para vista "Todos")
            const fullPayload = {
                ...order,
                estimatedPrepTime: prepTime,
                timestamp
            };

            const kitchenRoom = `tenant:${tenantId}:kitchen`;

            // Debug: Check how many clients are in the room
            const roomSockets = io.sockets.adapter.rooms.get(kitchenRoom);
            const clientCount = roomSockets ? roomSockets.size : 0;

            logger.info(`[KDS] Emitting kitchen:order_new to room: ${kitchenRoom}`, {
                orderNumber: order.orderNumber,
                orderId: order.id,
                itemCount: items.length,
                clientsInRoom: clientCount
            });

            io.to(kitchenRoom).emit('kitchen:order_new', fullPayload);
            io.to(kitchenRoom).emit('order:new', fullPayload); // Legacy

            logger.info(`[KDS] Events emitted successfully to ${clientCount} clients`);

            logger.info('[KDS] Broadcasted new order to KDS with station routing', {
                orderNumber: order.orderNumber,
                tenantId,
                stations: Array.from(itemsByStation.keys()),
                prepTime
            });
        } catch (error) {
            logger.error('KDS_STATION_BROADCAST_FAILED', {
                event: 'order_new_with_stations',
                orderId: order.id,
                tenantId: order.tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback: enviar orden completa a cocina general
            this.broadcastNewOrder(order);
        }
    }
}

export const kdsService = new KDSService();
