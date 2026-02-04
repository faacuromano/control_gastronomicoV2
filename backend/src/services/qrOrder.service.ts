/**
 * @fileoverview Servicio de pedidos via QR.
 * Permite a los clientes colocar pedidos directamente desde el menu QR
 * cuando la mesa esta abierta por un mesero (modo self-order).
 *
 * Flujo:
 * 1. Cliente escanea QR y navega el menu
 * 2. Cliente agrega items al carrito y confirma
 * 3. Este servicio valida que la mesa este OCUPADA y con orden activa
 * 4. Agrega los items a la orden existente usando orderService.addItemsToOrder
 * 5. Emite notificacion en tiempo real a los meseros
 *
 * @module services/qrOrder.service
 */

import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import { qrService } from './qr.service';
import { orderService } from './order.service';
import { logger } from '../utils/logger';
import {
    NotFoundError,
    ValidationError,
    ConflictError
} from '../utils/errors';
import type { OrderItemInput } from '../types/order.types';

/**
 * Input de item para pedido QR (subconjunto simplificado de OrderItemInput).
 * El cliente solo puede especificar productId, cantidad, notas y modificadores.
 * Los precios se obtienen de la BD para prevenir manipulacion.
 */
export interface QrOrderItemInput {
    productId: number;
    quantity: number;
    notes?: string;
    /** IDs de modificadores seleccionados (el precio se obtiene de la BD) */
    modifierIds?: number[];
    /** IDs de ingredientes a remover */
    removedIngredientIds?: number[];
}

/**
 * Resultado de la operacion de colocar pedido via QR.
 */
export interface QrOrderResult {
    orderId: number;
    orderNumber: number;
    itemCount: number;
    total: number;
    tableName: string;
}

/**
 * Payload del evento waiter:qr_order_placed.
 */
export interface QrOrderPlacedEvent {
    orderId: number;
    orderNumber: number;
    tableId: number;
    tableName: string;
    itemCount: number;
    total: number;
    timestamp: Date;
}

export class QrOrderService {
    /**
     * Coloca un pedido desde el menu QR.
     * El cliente debe escanear un QR de mesa que este OCUPADA con orden activa.
     *
     * Validaciones:
     * 1. Codigo QR valido y activo
     * 2. QR tiene mesa asociada
     * 3. Self-order habilitado para el tenant
     * 4. Mesa en estado OCCUPIED
     * 5. Mesa tiene orden activa (currentOrderId)
     *
     * @param code - Codigo del QR escaneado
     * @param items - Items del carrito del cliente
     * @returns Resultado con datos de la orden
     */
    async placeOrder(code: string, items: QrOrderItemInput[]): Promise<QrOrderResult> {
        // 1. Validar QR y obtener datos de mesa
        const qrData = await qrService.validateAndScan(code);

        // 2. Validar que el QR tenga mesa asociada
        if (!qrData.tableId) {
            throw new ValidationError('Este QR no esta asociado a una mesa');
        }

        // 3. Validar que self-order este habilitado
        if (!qrData.config.selfOrderEnabled) {
            throw new ValidationError('El pedido por QR no esta habilitado');
        }

        // 4. Validar que la mesa este OCUPADA
        if (qrData.tableStatus !== 'OCCUPIED') {
            throw new ConflictError('La mesa no esta abierta. Por favor solicita al mesero que abra la mesa');
        }

        // 5. Validar que hay una orden activa
        if (!qrData.currentOrderId) {
            throw new ConflictError('No hay una orden activa en esta mesa');
        }

        // 6. Validar que hay items en el pedido
        if (!items || items.length === 0) {
            throw new ValidationError('El pedido debe tener al menos un item');
        }

        // 7. Obtener datos de la mesa para el nombre
        const table = await prisma.table.findFirst({
            where: { id: qrData.tableId, tenantId: qrData.tenantId }
        });
        if (!table) {
            throw new NotFoundError('Mesa no encontrada');
        }

        // 8. Convertir items QR a formato OrderItemInput
        // Nota: Los precios de modificadores se validan en orderService.addItemsToOrder
        // mediante orderItemService.validateAndCalculateItems (que obtiene precios de la BD)
        const orderItems: OrderItemInput[] = items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
            // Convertir modifierIds a formato { id, price } con price placeholder
            // (el precio real se obtiene de la BD en validateAndCalculateItems)
            modifiers: item.modifierIds?.map(id => ({ id, price: 0 })),
            removedIngredientIds: item.removedIngredientIds
        }));

        // 9. Agregar items a la orden existente
        // Pasamos null como serverId porque es un pedido de cliente (sin mesero)
        const updatedOrder = await orderService.addItemsToOrder(
            qrData.currentOrderId,
            orderItems,
            0, // serverId=0 indica pedido de cliente via QR
            qrData.tenantId
        );

        // 10. Calcular total de items agregados para la notificacion
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
        const addedTotal = updatedOrder.items
            .slice(-orderItems.length) // Solo los items recien agregados
            .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);

        // 11. Emitir notificacion a los meseros
        this.notifyWaiters(qrData.tenantId, {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            tableId: qrData.tableId,
            tableName: table.name,
            itemCount,
            total: addedTotal,
            timestamp: new Date()
        });

        return {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            itemCount,
            total: addedTotal,
            tableName: table.name
        };
    }

    /**
     * Emite evento de notificacion a los meseros del tenant.
     * Usa el room `tenant:{tenantId}:waiters` para aislar por restaurante.
     */
    private notifyWaiters(tenantId: number, event: QrOrderPlacedEvent): void {
        try {
            const io = getIO();
            if (!io) {
                logger.warn('Socket.IO not available, skipping waiter notification');
                return;
            }

            io.to(`tenant:${tenantId}:waiters`).emit('waiter:qr_order_placed', event);

            logger.info('QR order notification sent to waiters', {
                tenantId,
                orderId: event.orderId,
                tableId: event.tableId,
                itemCount: event.itemCount
            });
        } catch (error) {
            logger.error('Failed to send waiter notification', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

export const qrOrderService = new QrOrderService();
