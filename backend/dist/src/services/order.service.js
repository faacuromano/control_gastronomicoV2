"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const prisma_1 = require("../lib/prisma");
const stockMovement_service_1 = require("./stockMovement.service");
const client_1 = require("@prisma/client");
const stockService = new stockMovement_service_1.StockMovementService();
class OrderService {
    async createOrder(data) {
        return await prisma_1.prisma.$transaction(async (tx) => {
            let subtotal = 0;
            let total = 0;
            // 1. Validate Products & Calculate Totals
            const itemDataList = [];
            const stockUpdates = [];
            for (const item of data.items) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    include: { ingredients: true } // Need this for stock
                });
                if (!product)
                    throw new Error(`Product ID ${item.productId} not found`);
                if (!product.isActive)
                    throw new Error(`Product ${product.name} is not active`);
                const price = Number(product.price);
                const itemTotal = price * item.quantity;
                subtotal += itemTotal;
                itemDataList.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: price,
                    notes: item.notes,
                    status: 'PENDING'
                });
                // Prepare Stock Updates (if stockable)
                if (product.isStockable && product.ingredients.length > 0) {
                    for (const ing of product.ingredients) {
                        stockUpdates.push({
                            ingredientId: ing.ingredientId,
                            quantity: Number(ing.quantity) * item.quantity // Recipe Qty * Order Qty
                        });
                    }
                }
            }
            total = subtotal; // Apply discounts here if needed
            // 2. Create Order & Items
            // We explicitly enable 'orderNumber' autoincrement in generic SQL, 
            // but Prisma needs to handle the logic if not handled by DB trigger/sequence.
            // Since we defined @default(autoincrement) on ID, and orderNumber is unique, 
            // we might need to manually set orderNumber or rely on a separate counter if MySQL can't do two auto-incs.
            // Wait, schema has `id @autoincrement` AND `orderNumber @unique`. 
            // User fixed `orderNumber` to be UNIQUE, NOT autoincrement in the schema fix?
            // "Modified the `orderNumber` field... to `@unique` to resolve a Prisma schema parsing error".
            // This means WE must generate the orderNumber.
            const lastOrder = await tx.order.findFirst({ orderBy: { orderNumber: 'desc' } });
            const nextOrderNumber = (lastOrder?.orderNumber || 0) + 1;
            // Check for active shift for the server (user)
            if (!data.serverId) {
                throw new Error('Server ID is required to create an order');
            }
            const activeShift = await tx.cashShift.findFirst({
                where: {
                    userId: data.serverId,
                    endTime: null
                }
            });
            if (!activeShift) {
                throw new Error('NO_OPEN_SHIFT: Debes abrir un turno de caja antes de vender.');
            }
            const createData = {
                orderNumber: nextOrderNumber,
                channel: data.channel ?? 'POS',
                status: data.paymentMethod ? 'CONFIRMED' : 'OPEN',
                paymentStatus: data.paymentMethod ? 'PAID' : 'PENDING',
                subtotal,
                total,
                businessDate: new Date(),
                items: {
                    create: itemDataList.map(item => ({
                        product: { connect: { id: item.productId } },
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        notes: item.notes ?? null,
                        status: 'PENDING'
                    }))
                }
            };
            if (data.paymentMethod) {
                createData.payments = {
                    create: [{
                            amount: total,
                            method: data.paymentMethod,
                            shiftId: activeShift.id
                        }]
                };
                createData.closedAt = new Date(); // If paid, we can consider it closed for Fast Food flow? Or wait for Delivery?
                // For POS fast food, it's usually instant.
            }
            if (data.tableId)
                createData.tableId = data.tableId;
            if (data.clientId)
                createData.clientId = data.clientId;
            if (data.serverId)
                createData.serverId = data.serverId;
            console.log('DEBUG: Creating Order with data:', JSON.stringify(createData, null, 2));
            const order = await tx.order.create({
                data: createData,
                include: { items: true }
            });
            // 3. Update Stock (Deduction)
            // Standardized via StockMovementService using the same transaction
            for (const update of stockUpdates) {
                await stockService.register(update.ingredientId, client_1.StockMoveType.SALE, update.quantity, tx // Pass transaction context
                );
            }
            // 4. Update Table Status (If applicable)
            if (data.tableId) {
                await tx.table.update({
                    where: { id: data.tableId },
                    data: {
                        status: 'OCCUPIED',
                        currentOrderId: order.id
                    }
                });
            }
            return order;
        });
    }
    async getRecentOrders() {
        return await prisma_1.prisma.order.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } }
        });
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map