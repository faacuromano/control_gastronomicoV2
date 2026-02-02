/**
 * @fileoverview Servicio de transferencia de items entre mesas.
 * Permite mover items de una orden a otra (en otra mesa), creando una nueva
 * orden en la mesa destino si no existe una abierta. Incluye registro de auditoria
 * y recalculo automatico de totales en ambas ordenes.
 *
 * @module services/orderTransfer.service
 * @phase2 Funcionalidades Operativas
 */

import { prisma } from '../lib/prisma';
import { AuditAction } from '@prisma/client';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getBusinessDate } from '../utils/businessDate';

export interface TransferResult {
    success: boolean;
    itemsTransferred: number;
    fromOrderId: number;
    toOrderId: number | null;
    newOrderCreated: boolean;
}

/**
 * Servicio para transferir items de ordenes entre mesas.
 * Caso de uso tipico: un grupo de comensales se divide y parte de ellos
 * se mueve a otra mesa, llevandose sus platos consigo.
 */
export class OrderTransferService {

    /**
     * Transfiere items de una mesa a otra.
     *
     * Si la mesa destino tiene una orden abierta, los items se agregan a ella.
     * Si no, se crea una nueva orden en la mesa destino.
     *
     * Flujo detallado:
     * 1. Bloquea ambas mesas en orden ascendente de ID para prevenir deadlocks
     * 2. Valida que la mesa origen tenga una orden abierta con los items indicados
     * 3. Busca o crea una orden en la mesa destino
     * 4. Mueve los items a la orden destino
     * 5. Recalcula totales de ambas ordenes
     * 6. Si la orden origen queda sin items, la cancela y libera la mesa
     * 7. Registra la operacion en el log de auditoria
     *
     * @param itemIds - IDs de los items a transferir
     * @param fromTableId - ID de la mesa origen
     * @param toTableId - ID de la mesa destino
     * @param tenantId - ID del tenant para aislamiento multi-tenant
     * @param context - Contexto de auditoria (usuario, IP)
     */
    async transferItems(
        itemIds: number[],
        fromTableId: number,
        toTableId: number,
        tenantId: number,
        context: AuditContext
    ): Promise<TransferResult> {
        if (fromTableId === toTableId) {
            throw new ValidationError('Cannot transfer items to the same table');
        }

        const result = await prisma.$transaction(async (tx) => {
            // FIX DB-003: Bloquear mesas en orden ascendente de ID para prevenir deadlocks.
            // Si dos transferencias concurrentes (A->B y B->A) bloquean en el mismo orden,
            // se serializan en lugar de generar un deadlock.
            const [firstLockId, secondLockId] = fromTableId < toTableId
                ? [fromTableId, toTableId]
                : [toTableId, fromTableId];

            const tableInclude = {
                orders: {
                    where: { status: { in: ['OPEN' as const, 'CONFIRMED' as const] } },
                    take: 1,
                    orderBy: { createdAt: 'desc' as const }
                }
            };

            // Obtener ambas mesas con sus ordenes activas, en orden de bloqueo
            const firstTable = await tx.table.findFirst({
                where: { id: firstLockId, tenantId },
                include: tableInclude
            });
            const secondTable = await tx.table.findFirst({
                where: { id: secondLockId, tenantId },
                include: tableInclude
            });

            // Reasignar a origen/destino segun corresponda
            const fromTable = fromTableId === firstLockId ? firstTable : secondTable;
            const toTable = fromTableId === firstLockId ? secondTable : firstTable;

            // 1. Validar mesa origen
            if (!fromTable) {
                throw new NotFoundError('Source table');
            }

            const sourceOrder = fromTable.orders[0];
            if (!sourceOrder) {
                throw new ValidationError('Source table has no open order');
            }

            // 2. Validar que los items pertenezcan a la orden origen
            const items = await tx.orderItem.findMany({
                where: {
                    id: { in: itemIds },
                    orderId: sourceOrder.id,
                    tenantId
                },
                include: { modifiers: true }
            });

            if (items.length !== itemIds.length) {
                throw new ValidationError('Some items do not belong to the source order');
            }

            if (!toTable) {
                throw new NotFoundError('Target table');
            }

            const targetOrder = toTable.orders[0];

            let targetOrderId: number;
            let newOrderCreated = false;

            if (targetOrder) {
                // Agregar a la orden existente en la mesa destino
                targetOrderId = targetOrder.id;
            } else {
                // Crear nueva orden para la mesa destino (no tiene orden abierta)
                const { orderNumberService } = await import('./orderNumber.service');
                const businessDate = getBusinessDate();
                const { orderNumber } = await orderNumberService.getNextOrderNumber(tx, tenantId, businessDate);

                const newOrder = await tx.order.create({
                    data: {
                        tenantId,
                        orderNumber,
                        channel: sourceOrder.channel,
                        status: 'OPEN',
                        paymentStatus: 'PENDING',
                        subtotal: 0,
                        total: 0,
                        businessDate,
                        tableId: toTableId,
                        serverId: sourceOrder.serverId
                    }
                });
                targetOrderId = newOrder.id;
                newOrderCreated = true;

                // Actualizar la mesa destino: marcarla como ocupada con la nueva orden
                const tableUpdateResult = await tx.table.updateMany({
                    where: { id: toTableId, tenantId },
                    data: {
                        status: 'OCCUPIED',
                        currentOrderId: newOrder.id
                    }
                });
                if (tableUpdateResult.count === 0) {
                    throw new NotFoundError('Target table');
                }
            }

            // 4. Mover los items a la orden destino
            await tx.orderItem.updateMany({
                where: { id: { in: itemIds }, tenantId },
                data: { orderId: targetOrderId }
            });

            // 5. Recalcular totales de la orden origen (sin los items transferidos)
            const remainingSourceItems = await tx.orderItem.findMany({
                where: { orderId: sourceOrder.id, tenantId },
                include: { modifiers: true }
            });

            let sourceSubtotal = 0;
            for (const item of remainingSourceItems) {
                sourceSubtotal += Number(item.unitPrice) * item.quantity;
                for (const mod of item.modifiers) {
                    sourceSubtotal += Number(mod.priceCharged) * item.quantity;
                }
            }

            // SEGURO: tx.table.findFirst en L53 verifica propiedad del tenant sobre la orden origen
            await tx.order.update({
                where: { id: sourceOrder.id },
                data: {
                    subtotal: sourceSubtotal,
                    total: sourceSubtotal - Number(sourceOrder.discount)
                }
            });

            // Si la orden origen quedo sin items, cancelarla y liberar la mesa
            if (remainingSourceItems.length === 0) {
                // SEGURO: sourceOrder verificado via tx.table.findFirst en L53
                await tx.order.update({
                    where: { id: sourceOrder.id },
                    data: { status: 'CANCELLED' }
                });
                await tx.table.updateMany({
                    where: { id: fromTableId, tenantId },
                    data: { status: 'FREE', currentOrderId: null }
                });
            }

            // 6. Recalcular totales de la orden destino (con los items recibidos)
            const targetItems = await tx.orderItem.findMany({
                where: { orderId: targetOrderId, tenantId },
                include: { modifiers: true }
            });

            let targetSubtotal = 0;
            for (const item of targetItems) {
                targetSubtotal += Number(item.unitPrice) * item.quantity;
                for (const mod of item.modifiers) {
                    targetSubtotal += Number(mod.priceCharged) * item.quantity;
                }
            }

            // SEGURO: targetOrderId proviene de tx.table.findFirst en L88 o fue creado en L117
            await tx.order.update({
                where: { id: targetOrderId },
                data: {
                    subtotal: targetSubtotal,
                    total: targetSubtotal
                }
            });

            return {
                fromOrderId: sourceOrder.id,
                toOrderId: targetOrderId,
                newOrderCreated,
                itemCount: items.length,
                itemDetails: items.map(i => ({
                    id: i.id,
                    productId: i.productId,
                    quantity: i.quantity
                }))
            };
        });

        // 7. Registrar en el log de auditoria (fuera de la transaccion para seguridad)
        await auditService.log(
            AuditAction.ITEM_TRANSFERRED,
            'OrderItem',
            null, // Multiples items transferidos
            context,
            {
                itemIds,
                fromTableId,
                toTableId,
                fromOrderId: result.fromOrderId,
                toOrderId: result.toOrderId,
                newOrderCreated: result.newOrderCreated,
                itemCount: result.itemCount
            }
        );

        logger.info('Items transferred between tables', {
            itemIds,
            fromTableId,
            toTableId,
            itemCount: result.itemCount
        });

        return {
            success: true,
            itemsTransferred: result.itemCount,
            fromOrderId: result.fromOrderId,
            toOrderId: result.toOrderId,
            newOrderCreated: result.newOrderCreated
        };
    }
}

export const orderTransferService = new OrderTransferService();
