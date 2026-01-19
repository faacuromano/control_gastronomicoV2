/**
 * @fileoverview Sync Service for offline synchronization
 * Handles pull (server→client) and push (client→server) operations
 * 
 * @module services/sync.service
 */

import { prisma } from '../lib/prisma';
import { OrderChannel, PaymentMethod, AuditAction } from '@prisma/client';
import { orderService } from './order.service';
import { auditService, type AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import type {
    SyncPullResponse,
    SyncProduct,
    SyncCategory,
    SyncPrinterRouting,
    SyncPushRequest,
    SyncPushResponse,
    OrderMapping,
    SyncError,
    SyncWarning,
    PendingOrder,
    PendingPayment
} from '../types/sync.types';

/**
 * Service for handling offline data synchronization
 */
export class SyncService {

    /**
     * Pull all data needed for offline operation
     * Called when client goes online or on startup
     */
    async pull(): Promise<SyncPullResponse> {
        const [products, categories, printerRouting] = await Promise.all([
            this.getProductsForSync(),
            this.getCategoriesForSync(),
            this.getPrinterRoutingForSync()
        ]);

        return {
            products,
            categories,
            printerRouting,
            serverTime: new Date().toISOString(),
            syncToken: this.generateSyncToken()
        };
    }

    /**
     * Push offline operations to server
     * Processes orders and payments created offline
     */
    async push(
        request: SyncPushRequest, 
        context: AuditContext
    ): Promise<SyncPushResponse> {
        const orderMappings: OrderMapping[] = [];
        const errors: SyncError[] = [];
        const warnings: SyncWarning[] = [];

        // 1. Process orders first (they need real IDs before payments)
        for (const pendingOrder of request.pendingOrders) {
            try {
                const result = await this.processOfflineOrder(pendingOrder, context);
                orderMappings.push(result.mapping);
                if (result.warnings.length > 0) {
                    warnings.push(...result.warnings);
                }
            } catch (err: any) {
                logger.error('Sync order failed', { tempId: pendingOrder.tempId, error: err.message });
                errors.push({
                    tempId: pendingOrder.tempId,
                    code: 'ORDER_SYNC_FAILED',
                    message: err.message
                });
                orderMappings.push({
                    tempId: pendingOrder.tempId,
                    realId: null,
                    orderNumber: null,
                    status: 'ERROR'
                });
            }
        }

        // 2. Create mapping for payment resolution
        const tempToRealId = new Map<string, number>();
        for (const mapping of orderMappings) {
            if (mapping.status === 'SYNCED' && mapping.realId) {
                tempToRealId.set(mapping.tempId, mapping.realId);
            }
        }

        // 3. Process payments using the mapping
        for (const pendingPayment of request.pendingPayments) {
            try {
                await this.processOfflinePayment(pendingPayment, tempToRealId, context);
            } catch (err: any) {
                logger.error('Sync payment failed', { 
                    tempOrderId: pendingPayment.tempOrderId, 
                    error: err.message 
                });
                errors.push({
                    tempId: pendingPayment.tempOrderId,
                    code: 'PAYMENT_SYNC_FAILED',
                    message: err.message
                });
            }
        }

        // 4. Log sync operation
        await auditService.log(
            AuditAction.CONFIG_CHANGED, // TODO: Add SYNC_COMPLETED to enum
            'Sync',
            null,
            context,
            {
                clientId: request.clientId,
                ordersProcessed: request.pendingOrders.length,
                paymentsProcessed: request.pendingPayments.length,
                errors: errors.length,
                warnings: warnings.length
            }
        );

        return {
            success: errors.length === 0,
            orderMappings,
            errors,
            warnings,
            syncedAt: new Date().toISOString()
        };
    }

    /**
     * Process a single offline order
     */
    private async processOfflineOrder(
        pendingOrder: PendingOrder,
        context: AuditContext
    ): Promise<{ mapping: OrderMapping; warnings: SyncWarning[] }> {
        const warnings: SyncWarning[] = [];

        // Get active cash shift
        const activeShift = await prisma.cashShift.findFirst({
            where: { endTime: null },
            orderBy: { startTime: 'desc' }
        });

        if (!activeShift) {
            throw new ValidationError('No active cash shift for sync');
        }

        // Check if original shift differs from current
        if (pendingOrder.shiftId && pendingOrder.shiftId !== activeShift.id) {
            warnings.push({
                tempId: pendingOrder.tempId,
                code: 'SHIFT_REASSIGNED',
                message: `Order reassigned from shift ${pendingOrder.shiftId} to ${activeShift.id}`
            });
        }

        // Create order using existing service
        // userId is guaranteed by the sync controller before calling this
        if (!context.userId) {
            throw new ValidationError('userId required for sync');
        }
        const order = await orderService.createOrder({
            userId: context.userId,
            items: pendingOrder.items,
            channel: pendingOrder.channel,
            tableId: pendingOrder.tableId,
            clientId: pendingOrder.clientId,
            // Note: payments handled separately
        });

        return {
            mapping: {
                tempId: pendingOrder.tempId,
                realId: order.id,
                orderNumber: order.orderNumber,
                status: 'SYNCED'
            },
            warnings
        };
    }

    /**
     * Process a single offline payment
     */
    private async processOfflinePayment(
        pendingPayment: PendingPayment,
        tempToRealId: Map<string, number>,
        context: AuditContext
    ): Promise<void> {
        const realOrderId = tempToRealId.get(pendingPayment.tempOrderId);

        if (!realOrderId) {
            throw new ValidationError(
                `Cannot find real order ID for temp ID: ${pendingPayment.tempOrderId}`
            );
        }

        // Get active shift for payment
        const activeShift = await prisma.cashShift.findFirst({
            where: { endTime: null },
            orderBy: { startTime: 'desc' }
        });

        if (!activeShift) {
            throw new ValidationError('No active cash shift for payment sync');
        }

        // Create payment
        await prisma.payment.create({
            data: {
                orderId: realOrderId,
                method: pendingPayment.method,
                amount: pendingPayment.amount,
                shiftId: activeShift.id
            }
        });

        // Update order payment status
        const order = await prisma.order.findUnique({
            where: { id: realOrderId },
            include: { payments: true }
        });

        if (order) {
            const totalPaid = order.payments.reduce(
                (sum, p) => sum + Number(p.amount), 
                0
            );
            const orderTotal = Number(order.total);

            await prisma.order.update({
                where: { id: realOrderId },
                data: {
                    paymentStatus: totalPaid >= orderTotal ? 'PAID' : 'PARTIAL'
                }
            });
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async getProductsForSync(): Promise<SyncProduct[]> {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                category: true,
                modifiers: {
                    include: {
                        modifierGroup: {
                            include: { options: true }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        return products.map(p => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            categoryId: p.categoryId,
            categoryName: p.category.name,
            isActive: p.isActive,
            productType: p.productType,
            modifierGroups: p.modifiers.map(m => ({
                id: m.modifierGroup.id,
                name: m.modifierGroup.name,
                minSelection: m.modifierGroup.minSelection,
                maxSelection: m.modifierGroup.maxSelection,
                options: m.modifierGroup.options.map(o => ({
                    id: o.id,
                    name: o.name,
                    price: Number(o.priceOverlay)
                }))
            }))
        }));
    }

    private async getCategoriesForSync(): Promise<SyncCategory[]> {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });

        return categories.map(c => ({
            id: c.id,
            name: c.name
        }));
    }

    private async getPrinterRoutingForSync(): Promise<SyncPrinterRouting[]> {
        const categories = await prisma.category.findMany({
            where: { printerId: { not: null } },
            include: { printer: true }
        });

        return categories
            .filter(c => c.printer !== null)
            .map(c => ({
                categoryId: c.id,
                printerId: c.printer!.id,
                printerName: c.printer!.name,
                connectionType: c.printer!.connectionType,
                ipAddress: c.printer!.ipAddress,
                windowsName: c.printer!.windowsName
            }));
    }

    private generateSyncToken(): string {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const syncService = new SyncService();
