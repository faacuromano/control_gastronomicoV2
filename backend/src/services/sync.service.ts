/**
 * @fileoverview Sync Service for offline synchronization
 * Handles pull (server→client) and push (client→server) operations
 * 
 * @module services/sync.service
 */

import { prisma } from '../lib/prisma';
import { withSerializableTransaction, type TransactionClient } from '../lib/prisma-extensions';
import { OrderChannel, PaymentMethod, PaymentStatus, AuditAction } from '@prisma/client';
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
    async pull(tenantId: number): Promise<SyncPullResponse> {
        const [products, categories, printerRouting] = await Promise.all([
            this.getProductsForSync(tenantId),
            this.getCategoriesForSync(tenantId),
            this.getPrinterRoutingForSync(tenantId)
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
        tenantId: number,
        context: AuditContext
    ): Promise<SyncPushResponse> {
        const orderMappings: OrderMapping[] = [];
        const errors: SyncError[] = [];
        const warnings: SyncWarning[] = [];

        // BIZ-009: Conflict detection — warn if server data changed since last sync
        const conflictWarnings = await this.validateSyncToken(request.syncToken, tenantId);
        warnings.push(...conflictWarnings);

        // BIZ-010: Idempotency check — detect duplicate tempIds in retry scenarios
        const seenTempIds = new Set<string>();
        for (const pendingOrder of request.pendingOrders) {
            if (seenTempIds.has(pendingOrder.tempId)) {
                warnings.push({
                    tempId: pendingOrder.tempId,
                    code: 'DUPLICATE_TEMP_ID',
                    message: `Duplicate tempId detected: ${pendingOrder.tempId}, skipping`
                });
            }
            seenTempIds.add(pendingOrder.tempId);
        }
        const uniqueOrders = request.pendingOrders.filter((o, i, arr) =>
            arr.findIndex(x => x.tempId === o.tempId) === i
        );

        // 1. Process orders first (they need real IDs before payments)
        for (const pendingOrder of uniqueOrders) {
            try {
                const result = await this.processOfflineOrder(pendingOrder, tenantId, context);
                orderMappings.push(result.mapping);
                if (result.warnings.length > 0) {
                    warnings.push(...result.warnings);
                }
            } catch (error: any) {
                logger.error('Sync order failed', { tempId: pendingOrder.tempId, error: error.message });
                errors.push({
                    tempId: pendingOrder.tempId,
                    code: 'ORDER_SYNC_FAILED',
                    message: error.message
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
                await this.processOfflinePayment(pendingPayment, tenantId, tempToRealId, context);
            } catch (error: any) {
                logger.error('Sync payment failed', {
                    tempOrderId: pendingPayment.tempOrderId,
                    error: error.message
                });
                errors.push({
                    tempId: pendingPayment.tempOrderId,
                    code: 'PAYMENT_SYNC_FAILED',
                    message: error.message
                });
            }
        }

        // 4. DB-010: Reconcile payment statuses after all payments processed
        //    If some payments failed, the order paymentStatus may be inconsistent
        for (const mapping of orderMappings) {
            if (mapping.status === 'SYNCED' && mapping.realId) {
                try {
                    await this.reconcileOrderPaymentStatus(mapping.realId, tenantId);
                } catch (error: any) {
                    logger.warn('Payment status reconciliation failed', {
                        orderId: mapping.realId,
                        error: error.message,
                    });
                }
            }
        }

        // 5. Log sync operation
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
        tenantId: number,
        context: AuditContext
    ): Promise<{ mapping: OrderMapping; warnings: SyncWarning[] }> {
        const warnings: SyncWarning[] = [];

        // Get active cash shift
        const activeShift = await prisma.cashShift.findFirst({
            where: { tenantId, endTime: null },
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
            tenantId,
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
     * Process a single offline payment within a Serializable transaction.
     * 
     * @complexity O(1) - Single transaction with atomic read-modify-write
     * @guarantee ACID - Serializable isolation prevents phantom payments
     * @implements TDD Section 1.2 - Serializable Transaction for Payment
     * 
     * FIX P0-003: Replaces separate CREATE + READ + UPDATE with atomic
     * transaction. Prevents race condition where concurrent payments
     * calculate incorrect totals.
     * 
     * Invariant: ∑Payments ≤ Order.total (validated before commit)
     */
    private async processOfflinePayment(
        pendingPayment: PendingPayment,
        tenantId: number,
        tempToRealId: Map<string, number>,
        context: AuditContext
    ): Promise<void> {
        const realOrderId = tempToRealId.get(pendingPayment.tempOrderId);

        if (!realOrderId) {
            throw new ValidationError(
                `Cannot find real order ID for temp ID: ${pendingPayment.tempOrderId}`
            );
        }

        await withSerializableTransaction(
            async (tx: TransactionClient) => {
                // Step 1: Get active shift (read-only, can be outside tx but included for atomicity)
                const activeShift = await tx.cashShift.findFirst({
                    where: { tenantId, endTime: null },
                    orderBy: { startTime: 'desc' }
                });

                if (!activeShift) {
                    throw new ValidationError('No active cash shift for payment sync');
                }

                // Step 2: Get order with existing payments INSIDE transaction
                // Serializable isolation ensures no phantom payments appear
                const order = await tx.order.findFirst({
                    where: { id: realOrderId, tenantId },
                    include: { payments: true }
                });

                if (!order) {
                    throw new ValidationError(`Order ${realOrderId} not found`);
                }

                // Step 3: Calculate current total paid BEFORE adding new payment
                const currentTotalPaid = order.payments.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0
                );
                const orderTotal = Number(order.total);

                // Step 4: Invariant check - prevent overpayment
                // Per TDD: ∑Payments ≤ Order.total
                const proposedTotalPaid = currentTotalPaid + pendingPayment.amount;
                const overpaymentMargin = 0.01; // Allow 1 cent tolerance

                if (proposedTotalPaid > orderTotal + overpaymentMargin) {
                    logger.warn('Overpayment detected in offline sync', {
                        orderId: realOrderId,
                        orderTotal,
                        currentTotalPaid,
                        proposedPayment: pendingPayment.amount,
                        proposedTotal: proposedTotalPaid,
                    });
                    // Don't throw - cap the payment to remaining amount
                    const remainingAmount = Math.max(0, orderTotal - currentTotalPaid);
                    if (remainingAmount <= 0) {
                        logger.info('Order already fully paid, skipping payment', {
                            orderId: realOrderId,
                        });
                        return; // Skip this payment
                    }
                    // Adjust payment amount to remaining
                    pendingPayment.amount = remainingAmount;
                }

                // Step 5: Create payment INSIDE transaction
                await tx.payment.create({
                    data: {
                        tenantId,
                        orderId: realOrderId,
                        method: pendingPayment.method,
                        amount: pendingPayment.amount,
                        shiftId: activeShift.id
                    }
                });

                // Step 6: Calculate new total and update status ATOMICALLY
                const newTotalPaid = currentTotalPaid + pendingPayment.amount;
                const newStatus = newTotalPaid >= orderTotal ? 'PAID' : 'PARTIAL';

                await tx.order.updateMany({
                    where: { id: realOrderId, tenantId },
                    data: { paymentStatus: newStatus }
                });

                logger.debug('Offline payment processed in serializable tx', {
                    orderId: realOrderId,
                    paymentAmount: pendingPayment.amount,
                    newTotalPaid,
                    newStatus,
                });
            },
            {
                resourceName: `Order:${realOrderId}:Payment`,
                lockTimeoutMs: 5000,
            }
        );
    }

    // =========================================================================
    // DB-010: PAYMENT RECONCILIATION
    // =========================================================================

    /**
     * Reconcile order payment status after sync.
     * Ensures paymentStatus matches actual sum of payments.
     * Handles partial failure where some payments succeeded but others didn't.
     */
    private async reconcileOrderPaymentStatus(orderId: number, tenantId: number): Promise<void> {
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            include: { payments: true },
        });

        if (!order) return;

        const totalPaid = order.payments.reduce(
            (sum, p) => sum + Number(p.amount), 0
        );
        const orderTotal = Number(order.total);

        let expectedStatus: PaymentStatus;
        if (totalPaid <= 0) {
            expectedStatus = PaymentStatus.PENDING;
        } else if (totalPaid >= orderTotal) {
            expectedStatus = PaymentStatus.PAID;
        } else {
            expectedStatus = PaymentStatus.PARTIAL;
        }

        if (order.paymentStatus !== expectedStatus) {
            logger.warn('Payment status inconsistency detected, reconciling', {
                orderId,
                currentStatus: order.paymentStatus,
                expectedStatus,
                totalPaid,
                orderTotal,
            });
            await prisma.order.updateMany({
                where: { id: orderId, tenantId },
                data: { paymentStatus: expectedStatus },
            });
        }
    }

    // =========================================================================
    // BIZ-009: CONFLICT DETECTION
    // =========================================================================

    /**
     * Validate sync token to detect conflicts from concurrent offline clients.
     * If server data changed since client's last pull, warn about potential conflicts.
     */
    async validateSyncToken(
        syncToken: string | undefined,
        tenantId: number
    ): Promise<SyncWarning[]> {
        const warnings: SyncWarning[] = [];

        if (!syncToken) {
            warnings.push({
                tempId: '__sync__',
                code: 'MISSING_SYNC_TOKEN',
                message: 'No sync token provided. Data may be stale.',
            });
            return warnings;
        }

        // Extract timestamp from sync token (format: sync_<timestamp>_<random>)
        const tokenParts = syncToken.split('_');
        if (tokenParts.length < 2) return warnings;

        const lastSyncTime = parseInt(tokenParts[1] || '0', 10);
        if (isNaN(lastSyncTime) || lastSyncTime <= 0) return warnings;

        const lastSyncDate = new Date(lastSyncTime);

        // Check if any orders were created by OTHER users since last sync
        const recentOrders = await prisma.order.count({
            where: {
                tenantId,
                createdAt: { gt: lastSyncDate },
            },
        });

        if (recentOrders > 0) {
            warnings.push({
                tempId: '__sync__',
                code: 'CONCURRENT_CHANGES',
                message: `${recentOrders} order(s) created since last sync at ${lastSyncDate.toISOString()}. Review for conflicts.`,
            });
        }

        // Check if products/prices changed since last sync
        const recentProductChanges = await prisma.product.count({
            where: {
                tenantId,
                updatedAt: { gt: lastSyncDate },
            },
        });

        if (recentProductChanges > 0) {
            warnings.push({
                tempId: '__sync__',
                code: 'CATALOG_CHANGED',
                message: `${recentProductChanges} product(s) updated since last sync. Prices may differ.`,
            });
        }

        return warnings;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async getProductsForSync(tenantId: number): Promise<SyncProduct[]> {
        const products = await prisma.product.findMany({
            where: { isActive: true, tenantId },
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

    private async getCategoriesForSync(tenantId: number): Promise<SyncCategory[]> {
        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });

        return categories.map(c => ({
            id: c.id,
            name: c.name
        }));
    }

    private async getPrinterRoutingForSync(tenantId: number): Promise<SyncPrinterRouting[]> {
        const categories = await prisma.category.findMany({
            where: { tenantId, printerId: { not: null } },
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
