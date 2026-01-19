"use strict";
/**
 * @fileoverview Sync Service for offline synchronization
 * Handles pull (server→client) and push (client→server) operations
 *
 * @module services/sync.service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const order_service_1 = require("./order.service");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Service for handling offline data synchronization
 */
class SyncService {
    /**
     * Pull all data needed for offline operation
     * Called when client goes online or on startup
     */
    async pull() {
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
    async push(request, context) {
        const orderMappings = [];
        const errors = [];
        const warnings = [];
        // 1. Process orders first (they need real IDs before payments)
        for (const pendingOrder of request.pendingOrders) {
            try {
                const result = await this.processOfflineOrder(pendingOrder, context);
                orderMappings.push(result.mapping);
                if (result.warnings.length > 0) {
                    warnings.push(...result.warnings);
                }
            }
            catch (err) {
                logger_1.logger.error('Sync order failed', { tempId: pendingOrder.tempId, error: err.message });
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
        const tempToRealId = new Map();
        for (const mapping of orderMappings) {
            if (mapping.status === 'SYNCED' && mapping.realId) {
                tempToRealId.set(mapping.tempId, mapping.realId);
            }
        }
        // 3. Process payments using the mapping
        for (const pendingPayment of request.pendingPayments) {
            try {
                await this.processOfflinePayment(pendingPayment, tempToRealId, context);
            }
            catch (err) {
                logger_1.logger.error('Sync payment failed', {
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
        await audit_service_1.auditService.log(client_1.AuditAction.CONFIG_CHANGED, // TODO: Add SYNC_COMPLETED to enum
        'Sync', null, context, {
            clientId: request.clientId,
            ordersProcessed: request.pendingOrders.length,
            paymentsProcessed: request.pendingPayments.length,
            errors: errors.length,
            warnings: warnings.length
        });
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
    async processOfflineOrder(pendingOrder, context) {
        const warnings = [];
        // Get active cash shift
        const activeShift = await prisma_1.prisma.cashShift.findFirst({
            where: { endTime: null },
            orderBy: { startTime: 'desc' }
        });
        if (!activeShift) {
            throw new errors_1.ValidationError('No active cash shift for sync');
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
            throw new errors_1.ValidationError('userId required for sync');
        }
        const order = await order_service_1.orderService.createOrder({
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
    async processOfflinePayment(pendingPayment, tempToRealId, context) {
        const realOrderId = tempToRealId.get(pendingPayment.tempOrderId);
        if (!realOrderId) {
            throw new errors_1.ValidationError(`Cannot find real order ID for temp ID: ${pendingPayment.tempOrderId}`);
        }
        // Get active shift for payment
        const activeShift = await prisma_1.prisma.cashShift.findFirst({
            where: { endTime: null },
            orderBy: { startTime: 'desc' }
        });
        if (!activeShift) {
            throw new errors_1.ValidationError('No active cash shift for payment sync');
        }
        // Create payment
        await prisma_1.prisma.payment.create({
            data: {
                orderId: realOrderId,
                method: pendingPayment.method,
                amount: pendingPayment.amount,
                shiftId: activeShift.id
            }
        });
        // Update order payment status
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: realOrderId },
            include: { payments: true }
        });
        if (order) {
            const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const orderTotal = Number(order.total);
            await prisma_1.prisma.order.update({
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
    async getProductsForSync() {
        const products = await prisma_1.prisma.product.findMany({
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
    async getCategoriesForSync() {
        const categories = await prisma_1.prisma.category.findMany({
            orderBy: { name: 'asc' }
        });
        return categories.map(c => ({
            id: c.id,
            name: c.name
        }));
    }
    async getPrinterRoutingForSync() {
        const categories = await prisma_1.prisma.category.findMany({
            where: { printerId: { not: null } },
            include: { printer: true }
        });
        return categories
            .filter(c => c.printer !== null)
            .map(c => ({
            categoryId: c.id,
            printerId: c.printer.id,
            printerName: c.printer.name,
            connectionType: c.printer.connectionType,
            ipAddress: c.printer.ipAddress,
            windowsName: c.printer.windowsName
        }));
    }
    generateSyncToken() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
//# sourceMappingURL=sync.service.js.map