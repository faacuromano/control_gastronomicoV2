"use strict";
/**
 * @fileoverview Order management service (Facade).
 * Handles order creation, updates, and lifecycle management.
 *
 * @module services/order.service
 * @pattern Facade - Delegates to specialized services for better SRP
 * @see orderItem.service.ts - Item validation and calculation
 * @see orderKitchen.service.ts - KDS operations
 * @see orderDelivery.service.ts - Delivery operations
 * @see orderStatus.service.ts - Status transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderService = exports.OrderService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const stockMovement_service_1 = require("./stockMovement.service");
const orderNumber_service_1 = require("./orderNumber.service");
const payment_service_1 = require("./payment.service");
const kds_service_1 = require("./kds.service");
const featureFlags_service_1 = require("./featureFlags.service");
const loyalty_service_1 = require("./loyalty.service");
const logger_1 = require("../utils/logger");
// Extracted specialized services
const orderKitchen_service_1 = require("./orderKitchen.service");
const orderDelivery_service_1 = require("./orderDelivery.service");
const orderStatus_service_1 = require("./orderStatus.service");
const orderItem_service_1 = require("./orderItem.service");
const stockService = new stockMovement_service_1.StockMovementService();
const loyaltyService = new loyalty_service_1.LoyaltyService();
class OrderService {
    /**
     * Get order by ID with full relations
     */
    async getById(id) {
        return await prisma_1.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                payments: true,
                client: true,
                driver: true
            }
        });
    }
    /**
     * Create a new order with items and optional payments.
     */
    async createOrder(data) {
        // Check if stock validation is enabled BEFORE transaction
        const stockEnabled = await (0, featureFlags_service_1.isFeatureEnabled)('enableStock');
        const txResult = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Validate Products & Calculate Totals (stock validation if enabled)
            const { itemDataList, stockUpdates, subtotal } = await this.validateAndCalculateItems(tx, data.items, stockEnabled);
            const total = subtotal; // Apply discounts here if needed
            // 2. Generate order number and get atomic businessDate
            // FIX P2002: Use the businessDate returned by getNextOrderNumber to ensure consistency
            const { orderNumber, businessDate } = await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
            // 3. Validate active shift
            if (!data.serverId) {
                throw new Error('Server ID is required to create an order');
            }
            const activeShift = await tx.cashShift.findFirst({
                where: { userId: data.serverId, endTime: null }
            });
            if (!activeShift) {
                throw new Error('NO_OPEN_SHIFT: Debes abrir un turno de caja antes de vender.');
            }
            // 4. Process payments - Map dynamic codes to PaymentMethod enum
            const mapToPaymentMethod = (code) => {
                const codeUpper = code.toUpperCase();
                // Direct enum matches
                if (codeUpper in client_1.PaymentMethod) {
                    return client_1.PaymentMethod[codeUpper];
                }
                // Common mappings for dynamic codes
                if (['DEBIT', 'CREDIT', 'DEBITO', 'CREDITO', 'TARJETA'].includes(codeUpper)) {
                    return client_1.PaymentMethod.CARD;
                }
                if (['EFECTIVO'].includes(codeUpper)) {
                    return client_1.PaymentMethod.CASH;
                }
                if (['TRANSFERENCIA', 'BANCO'].includes(codeUpper)) {
                    return client_1.PaymentMethod.TRANSFER;
                }
                if (['MERCADOPAGO', 'MP', 'QR'].includes(codeUpper)) {
                    return client_1.PaymentMethod.QR_INTEGRATED;
                }
                // Default to CASH for unknown codes
                console.warn(`[OrderService] Unknown payment code "${code}" - defaulting to CASH`);
                return client_1.PaymentMethod.CASH;
            };
            const singlePaymentMethod = data.paymentMethod === 'SPLIT' ? undefined :
                (data.paymentMethod ? mapToPaymentMethod(data.paymentMethod) : undefined);
            const splitPayments = data.payments?.map(p => ({
                ...p,
                method: mapToPaymentMethod(p.method)
            }));
            const paymentResult = payment_service_1.paymentService.processPayments(total, activeShift.id, singlePaymentMethod, splitPayments);
            // 5. Build order create data
            const createData = {
                orderNumber,
                channel: data.channel ?? 'POS',
                // FIX: Only set fulfillmentType for actual delivery orders
                // A POS order should NOT appear in delivery dashboard
                ...(data.channel === 'DELIVERY_APP' || (data.deliveryData?.address) ? {
                    fulfillmentType: 'SELF_DELIVERY'
                } : {}),
                status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
                paymentStatus: paymentResult.paymentStatus,
                subtotal,
                total,
                businessDate, // FIX P2002: Use the businessDate from getNextOrderNumber for atomic consistency
                items: {
                    create: itemDataList.map(item => ({
                        product: { connect: { id: item.productId } },
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        notes: item.notes ?? null,
                        status: 'PENDING',
                        ...(item.modifiers ? {
                            modifiers: {
                                create: item.modifiers.map(m => ({
                                    modifierOptionId: m.id,
                                    priceCharged: m.price
                                }))
                            }
                        } : {})
                    }))
                }
            };
            // Add optional fields
            if (data.tableId)
                createData.tableId = data.tableId;
            if (data.clientId)
                createData.clientId = data.clientId;
            if (data.serverId)
                createData.serverId = data.serverId;
            // Auto-close only if fully paid AND NOT a delivery order
            // Delivery orders must remain OPEN/CONFIRMED until delivered
            if (paymentResult.isFullyPaid && data.channel !== 'DELIVERY_APP') {
                createData.closedAt = new Date();
            }
            // Delivery Fields - No cast needed, OrderCreateData already has these fields
            if (data.deliveryData) {
                createData.deliveryAddress = data.deliveryData.address;
                // Only assign deliveryNotes if it's defined (exactOptionalPropertyTypes)
                if (data.deliveryData.notes !== undefined) {
                    createData.deliveryNotes = data.deliveryData.notes;
                }
                if (data.deliveryData.driverId) {
                    createData.driverId = data.deliveryData.driverId;
                }
            }
            // Add payments if any
            if (paymentResult.paymentsToCreate.length > 0) {
                createData.payments = { create: paymentResult.paymentsToCreate };
            }
            // 6. Create order - Use Prisma.OrderCreateInput for type safety
            const order = await tx.order.create({
                data: createData,
                include: { items: true }
            });
            // 7. Update Stock
            await this.processStockUpdates(tx, stockUpdates, orderNumber);
            // 8. Update Table Status
            // FIX RC-003: Verify table is FREE before occupying to prevent race condition
            if (data.tableId) {
                const table = await tx.table.findUnique({
                    where: { id: data.tableId }
                });
                if (!table) {
                    throw new Error(`INVALID_TABLE: Table with ID ${data.tableId} not found`);
                }
                if (table.status !== 'FREE') {
                    throw new Error(`TABLE_OCCUPIED: Table "${table.name}" is already occupied (currentOrderId: ${table.currentOrderId})`);
                }
                await tx.table.update({
                    where: { id: data.tableId },
                    data: { status: 'OCCUPIED', currentOrderId: order.id }
                });
            }
            // 9. Award loyalty points INSIDE TRANSACTION for atomicity
            // This ensures points are only awarded if the entire order creation succeeds
            let pointsAwarded = 0;
            if (data.clientId && paymentResult.isFullyPaid) {
                pointsAwarded = await loyaltyService.awardPoints(data.clientId, Number(total), tx);
            }
            return { order, pointsAwarded };
        });
        // Log loyalty points outside transaction (logging shouldn't fail the order)
        if (txResult.pointsAwarded > 0) {
            logger_1.logger.info('Loyalty points awarded', {
                clientId: data.clientId,
                points: txResult.pointsAwarded,
                orderId: txResult.order.id
            });
        }
        const order = txResult.order;
        // 10. Broadcast to KDS (Outside transaction)
        if (order.status === 'CONFIRMED' || order.status === 'OPEN') {
            const fullOrder = await this.getById(order.id);
            if (fullOrder) {
                kds_service_1.kdsService.broadcastNewOrder(fullOrder);
            }
        }
        return order;
    }
    /**
     * Assign a driver to an order.
     * @delegates orderDeliveryService.assignDriver
     */
    async assignDriver(orderId, driverId) {
        return orderDelivery_service_1.orderDeliveryService.assignDriver(orderId, driverId);
    }
    /**
     * Get active delivery orders.
     * @delegates orderDeliveryService.getDeliveryOrders
     */
    async getDeliveryOrders() {
        return orderDelivery_service_1.orderDeliveryService.getDeliveryOrders();
    }
    /**
     * Update individual order item status.
     * @delegates orderKitchenService.updateItemStatus
     */
    async updateItemStatus(itemId, status) {
        return orderKitchen_service_1.orderKitchenService.updateItemStatus(itemId, status);
    }
    /**
     * Mark all items in an order as SERVED.
     * @delegates orderKitchenService.markAllItemsServed
     */
    async markAllItemsServed(orderId) {
        return orderKitchen_service_1.orderKitchenService.markAllItemsServed(orderId);
    }
    /**
     * Validate products and calculate order totals.
     * @delegates orderItemService.validateAndCalculateItems
     */
    async validateAndCalculateItems(tx, items, stockEnabled = true) {
        return orderItem_service_1.orderItemService.validateAndCalculateItems(tx, items, stockEnabled);
    }
    /**
     * Process stock deductions for order items.
     * @private
     *
     * @business_rule
     * Prevents stock corruption coverage if the "Stock Management" module is disabled via TenantConfig (enableStock).
     * If disabled, this function exits gracefully without modifying database state.
     */
    async processStockUpdates(tx, stockUpdates, orderNumber) {
        // Only execute if Stock Module is enabled
        // This wrapper ensures we respect the TenantConfig contract
        await (0, featureFlags_service_1.executeIfEnabled)('enableStock', async () => {
            for (const update of stockUpdates) {
                await stockService.register(update.ingredientId, client_1.StockMoveType.SALE, update.quantity, `Order #${orderNumber}`, tx);
            }
        });
    }
    async getOrderByTable(tableId) {
        return await prisma_1.prisma.order.findFirst({
            where: {
                tableId,
                paymentStatus: { in: ['PENDING', 'PARTIAL'] }
            },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                payments: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async addItemsToOrder(orderId, newItems, serverId) {
        // Check if stock validation is enabled BEFORE transaction
        const stockEnabled = await (0, featureFlags_service_1.isFeatureEnabled)('enableStock');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Get existing order
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });
            if (!order)
                throw new Error('Order not found');
            if (order.paymentStatus === 'PAID')
                throw new Error('Cannot modify paid order');
            // 2. Validate and calculate new items using extracted service
            const { itemDataList, stockUpdates, subtotal: additionalTotal } = await orderItem_service_1.orderItemService.validateAndCalculateItems(tx, newItems, stockEnabled);
            // 3. Create new order items
            for (const itemData of itemDataList) {
                await tx.orderItem.create({
                    data: {
                        orderId,
                        productId: itemData.productId,
                        quantity: itemData.quantity,
                        unitPrice: itemData.unitPrice,
                        notes: itemData.notes ?? null,
                        status: 'PENDING',
                        ...(itemData.modifiers ? {
                            modifiers: {
                                create: itemData.modifiers.map((m) => ({
                                    modifierOptionId: m.id,
                                    priceCharged: m.price
                                }))
                            }
                        } : {})
                    }
                });
            }
            // 4. Update order totals and REOPEN if needed (for KDS visibility)
            const newSubtotal = Number(order.subtotal) + additionalTotal;
            const newTotal = Number(order.total) + additionalTotal;
            // If order was DELIVERED or PREPARED, reopen it to OPEN so new items appear in KDS
            const shouldReopen = ['DELIVERED', 'PREPARED'].includes(order.status);
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    subtotal: newSubtotal,
                    total: newTotal,
                    ...(shouldReopen ? { status: 'OPEN' } : {})
                },
                include: { items: { include: { product: true } } }
            });
            // 5. Update Stock (if module enabled)
            await (0, featureFlags_service_1.executeIfEnabled)('enableStock', async () => {
                const stockService = new stockMovement_service_1.StockMovementService();
                for (const update of stockUpdates) {
                    await stockService.register(update.ingredientId, client_1.StockMoveType.SALE, update.quantity, `Order #${order.orderNumber}`, tx);
                }
            });
            return updatedOrder;
        });
        // 6. Broadcast to KDS (Outside transaction) - NEW: Notify kitchen of added items
        const fullOrder = await this.getById(orderId);
        if (fullOrder) {
            kds_service_1.kdsService.broadcastOrderUpdate(fullOrder);
        }
        return result;
    }
    async getRecentOrders() {
        return await prisma_1.prisma.order.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } }
        });
    }
    /**
     * Get active orders for KDS (Kitchen Display System).
     * @delegates orderKitchenService.getActiveOrders
     */
    async getActiveOrders() {
        return orderKitchen_service_1.orderKitchenService.getActiveOrders();
    }
    /**
     * Update order status with state machine validation.
     * @delegates orderStatusService.updateStatus
     */
    async updateStatus(orderId, status) {
        return orderStatus_service_1.orderStatusService.updateStatus(orderId, status);
    }
}
exports.OrderService = OrderService;
exports.orderService = new OrderService();
//# sourceMappingURL=order.service.js.map