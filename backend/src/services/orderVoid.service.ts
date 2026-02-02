/**
 * @fileoverview Servicio de anulacion/cancelacion de items de orden.
 * Gestiona la eliminacion de items con reversion de stock y registro de auditoria.
 * Cada anulacion requiere un motivo valido para mantener trazabilidad completa.
 *
 * @module services/orderVoid.service
 * @phase2 Funcionalidades Operativas
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, AuditAction } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

const stockService = new StockMovementService();

/**
 * Razones validas para anular un item.
 * Se usan como catalogo cerrado para garantizar consistencia en reportes y auditorias.
 */
export const VOID_REASONS = [
    'CUSTOMER_CHANGED_MIND',
    'WRONG_ITEM',
    'QUALITY_ISSUE',
    'OUT_OF_STOCK',
    'KITCHEN_ERROR',
    'DUPLICATE_ENTRY',
    'OTHER'
] as const;

export type VoidReason = typeof VOID_REASONS[number];

export interface VoidItemInput {
    orderItemId: number;
    reason: VoidReason;
    notes?: string | undefined;
}

export interface VoidItemResult {
    success: boolean;
    orderItemId: number;
    stockReversed: boolean;
    newOrderTotal: number;
}

/**
 * Servicio para anular/cancelar items de ordenes.
 * La anulacion implica eliminar el item, revertir el stock consumido
 * y recalcular los totales de la orden afectada.
 */
export class OrderVoidService {

    /**
     * Anula (elimina) un item de una orden.
     *
     * Esta operacion realiza los siguientes pasos en una transaccion atomica:
     * 1. Elimina el item de la orden
     * 2. Revierte las deducciones de stock (devuelve ingredientes al inventario)
     * 3. Recalcula los totales de la orden
     * 4. Crea una entrada en el log de auditoria con el motivo
     *
     * @param input - Datos de anulacion con motivo obligatorio
     * @param tenantId - ID del tenant para aislamiento multi-tenant
     * @param context - Contexto de auditoria (usuario, IP)
     * @returns Resultado con el nuevo total de la orden
     */
    async voidItem(input: VoidItemInput, tenantId: number, context: AuditContext): Promise<VoidItemResult> {
        // Validar que el motivo sea uno de los permitidos
        if (!VOID_REASONS.includes(input.reason)) {
            throw new ValidationError(`Invalid void reason: ${input.reason}`);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Obtener el item con su producto, ingredientes y orden asociada
            const item = await tx.orderItem.findFirst({
                where: {
                    id: input.orderItemId,
                    order: { tenantId }
                },
                include: {
                    product: {
                        include: {
                            ingredients: {
                                include: { ingredient: true }
                            }
                        }
                    },
                    modifiers: true,
                    order: true
                }
            });

            if (!item) {
                throw new NotFoundError('OrderItem');
            }

            // 2. Verificar que la orden aun sea modificable (no pagada)
            if (item.order.paymentStatus === 'PAID') {
                throw new ValidationError('Cannot void items from a paid order');
            }

            // 3. Calcular el valor monetario del item que se esta removiendo
            const itemPrice = Number(item.unitPrice) * item.quantity;
            const modifiersPrice = item.modifiers.reduce(
                (sum, m) => sum + Number(m.priceCharged),
                0
            ) * item.quantity;
            const totalRemoved = itemPrice + modifiersPrice;

            // 4. Revertir stock si el producto es rastreable en inventario
            // PERF-010: Usar registerBatch en vez de N llamadas individuales a register()
            let stockReversed = false;
            if (item.product.isStockable && item.product.ingredients.length > 0) {
                const stockUpdates = item.product.ingredients.map(ing => ({
                    ingredientId: ing.ingredientId,
                    quantity: Number(ing.quantity) * item.quantity
                }));
                await stockService.registerBatch(
                    stockUpdates,
                    item.order.tenantId!,
                    StockMoveType.ADJUSTMENT,
                    `Void item #${item.id} - ${input.reason}`,
                    tx
                );
                stockReversed = true;
                logger.info('Stock reversed for voided item', {
                    orderItemId: item.id,
                    productId: item.productId,
                    reason: input.reason
                });
            }

            // 5. Eliminar modificadores primero (FK), luego el item
            await tx.orderItemModifier.deleteMany({
                where: { orderItemId: item.id, tenantId }
            });

            const deleteResult = await tx.orderItem.deleteMany({
                where: { id: item.id, tenantId }
            });
            if (deleteResult.count === 0) {
                throw new NotFoundError('OrderItem');
            }

            // 6. Recalcular totales de la orden sin el item eliminado
            const remainingItems = await tx.orderItem.findMany({
                where: { orderId: item.orderId, tenantId },
                include: { modifiers: true }
            });

            let newSubtotal = 0;
            for (const remaining of remainingItems) {
                newSubtotal += Number(remaining.unitPrice) * remaining.quantity;
                for (const mod of remaining.modifiers) {
                    newSubtotal += Number(mod.priceCharged) * remaining.quantity;
                }
            }

            // SEGURO: tx.orderItem.findFirst en L72 verifica propiedad del tenant via relacion con order
            await tx.order.update({
                where: { id: item.orderId },
                data: {
                    subtotal: newSubtotal,
                    total: newSubtotal - Number(item.order.discount)
                }
            });

            return {
                orderId: item.orderId,
                orderNumber: item.order.orderNumber,
                productName: item.product.name,
                quantity: item.quantity,
                totalRemoved,
                newOrderTotal: newSubtotal - Number(item.order.discount),
                stockReversed
            };
        });

        // 7. Registrar en log de auditoria (fuera de la transaccion por seguridad)
        await auditService.log(
            AuditAction.ITEM_VOIDED,
            'OrderItem',
            input.orderItemId,
            context,
            {
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                productName: result.productName,
                quantity: result.quantity,
                totalRemoved: result.totalRemoved,
                reason: input.reason,
                notes: input.notes,
                stockReversed: result.stockReversed
            }
        );

        logger.info('Order item voided', {
            orderItemId: input.orderItemId,
            orderId: result.orderId,
            reason: input.reason,
            totalRemoved: result.totalRemoved
        });

        return {
            success: true,
            orderItemId: input.orderItemId,
            stockReversed: result.stockReversed,
            newOrderTotal: result.newOrderTotal
        };
    }

    /**
     * Obtiene las razones de anulacion disponibles para mostrar en la UI.
     * Retorna codigo interno y etiqueta legible para el usuario.
     */
    getVoidReasons(): { code: VoidReason; label: string }[] {
        return [
            { code: 'CUSTOMER_CHANGED_MIND', label: 'Customer changed mind' },
            { code: 'WRONG_ITEM', label: 'Wrong item' },
            { code: 'QUALITY_ISSUE', label: 'Quality issue' },
            { code: 'OUT_OF_STOCK', label: 'Out of stock' },
            { code: 'KITCHEN_ERROR', label: 'Kitchen error' },
            { code: 'DUPLICATE_ENTRY', label: 'Duplicate entry' },
            { code: 'OTHER', label: 'Other' }
        ];
    }
}

export const orderVoidService = new OrderVoidService();
