"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableService = exports.TableService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
class TableService {
    // --- AREAS ---
    async getAreas() {
        return prisma_1.prisma.area.findMany({
            include: {
                tables: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });
    }
    async createArea(data) {
        if (!data.name)
            throw new errors_1.ValidationError('Area name is required');
        return prisma_1.prisma.area.create({ data });
    }
    async updateArea(id, data) {
        if (!data.name)
            throw new errors_1.ValidationError('Area name is required');
        return prisma_1.prisma.area.update({
            where: { id },
            data: { name: data.name }
        });
    }
    async deleteArea(id) {
        // Check if any table is occupied
        const occupiedCount = await prisma_1.prisma.table.count({
            where: { areaId: id, status: 'OCCUPIED' }
        });
        if (occupiedCount > 0)
            throw new errors_1.ConflictError('No se puede eliminar un área con mesas ocupadas');
        // Cascade delete tables (assuming no active orders blocking due to FK constraints)
        // If there are past orders linked to these tables, the DB might restrict deletion.
        // Ideally we should set Order.tableId to null, but let's try deleteMany.
        // For MVP test (clean tables), this will work.
        await prisma_1.prisma.table.deleteMany({ where: { areaId: id } });
        return prisma_1.prisma.area.delete({ where: { id } });
    }
    // --- TABLES ---
    async createTable(data) {
        const area = await prisma_1.prisma.area.findUnique({ where: { id: data.areaId } });
        if (!area)
            throw new errors_1.NotFoundError('Area not found');
        return prisma_1.prisma.table.create({
            data: {
                name: data.name,
                areaId: data.areaId,
                x: data.x || 0,
                y: data.y || 0,
                status: 'FREE'
            }
        });
    }
    async updateTable(id, data) {
        return prisma_1.prisma.table.update({
            where: { id },
            data
        });
    }
    async updateTablePosition(id, x, y) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: { x, y }
        });
    }
    async updatePositions(updates) {
        return prisma_1.prisma.$transaction(updates.map(u => prisma_1.prisma.table.update({
            where: { id: u.id },
            data: { x: u.x, y: u.y }
        })));
    }
    async getTable(id) {
        const table = await prisma_1.prisma.table.findUnique({
            where: { id },
            include: {
                orders: {
                    where: { status: 'OPEN' },
                    include: { items: true } // Basic info
                }
            }
        });
        if (!table)
            throw new errors_1.NotFoundError('Table not found');
        return table;
    }
    async deleteTable(id) {
        // Check if table is currently occupied
        const table = await prisma_1.prisma.table.findUnique({ where: { id } });
        if (!table)
            throw new errors_1.NotFoundError('Table not found');
        if (table.status === 'OCCUPIED')
            throw new errors_1.ConflictError('Cannot delete occupied table');
        return prisma_1.prisma.table.delete({ where: { id } });
    }
    // --- OPERATIONS ---
    async openTable(id, orderId) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }
    async closeTable(id) {
        return prisma_1.prisma.table.update({
            where: { id },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }
    // Used when an order is created with tableId
    async assignOrderToTable(tableId, orderId) {
        const table = await prisma_1.prisma.table.findUnique({ where: { id: tableId } });
        if (!table)
            throw new errors_1.NotFoundError('Table not found');
        if (table.status !== 'FREE' && table.status !== 'OCCUPIED') {
            // Maybe allow if occupied adding to same order? 
            // For simplicity, just update currentOrderId
        }
        return prisma_1.prisma.table.update({
            where: { id: tableId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }
    async freeTableFromOrder(tableId) {
        return prisma_1.prisma.table.update({
            where: { id: tableId },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }
    // --- FULL OPERATIONS (with order management) ---
    // --- FULL OPERATIONS (with order management) ---
    /**
     * Opens a table by creating an empty order and marking table as OCCUPIED
     */
    async openTableWithOrder(tableId, serverId, pax = 1) {
        // Use the new OrderNumberService and OrderService logic directly or replicate robustly
        // Prefer reusing OrderService.createOrder if possible, but here we need a specific flow.
        // We will use OrderNumberService for safe ID generation.
        return await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Verify table exists and is FREE
            const table = await tx.table.findUnique({ where: { id: tableId } });
            if (!table)
                throw new errors_1.NotFoundError('Table not found');
            if (table.status !== 'FREE')
                throw new errors_1.ConflictError('Table is already occupied');
            // 2. Verify server has active shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, endTime: null }
            });
            if (!shift)
                throw new errors_1.ConflictError('No hay turno de caja abierto. Abre un turno primero.');
            // 3. Get next order number SAFETY using OrderNumberService
            // Import dynamically or pass tx if service is adapted, but here we use the service instance logic
            // We need to import the service at the top of file
            const { orderNumberService } = await Promise.resolve().then(() => __importStar(require('./orderNumber.service')));
            // Cast tx to the type expected by getNextOrderNumber if needed, or rely on compatibility
            const orderNumber = await orderNumberService.getNextOrderNumber(tx);
            // 4. Create an empty order (no items)
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    serverId,
                    tableId,
                    channel: 'WAITER_APP',
                    status: 'OPEN',
                    paymentStatus: 'PENDING',
                    subtotal: 0,
                    total: 0,
                    businessDate: new Date()
                }
            });
            // 5. Update table to OCCUPIED
            await tx.table.update({
                where: { id: tableId },
                data: {
                    status: 'OCCUPIED',
                    currentOrderId: order.id
                }
            });
            return order;
        });
    }
    /**
     * Closes a table by processing payment and freeing the table
     */
    async closeTableWithPayment(tableId, serverId, payments) {
        return await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Get table and current order
            const table = await tx.table.findUnique({ where: { id: tableId } });
            if (!table)
                throw new errors_1.NotFoundError('Table not found');
            if (!table.currentOrderId)
                throw new errors_1.ConflictError('Table has no active order');
            const order = await tx.order.findUnique({
                where: { id: table.currentOrderId },
                include: { items: true }
            });
            if (!order)
                throw new errors_1.NotFoundError('Order not found');
            // 2. Verify shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, endTime: null }
            });
            if (!shift)
                throw new errors_1.ConflictError('No hay turno de caja abierto');
            // 3. Use PaymentService for calculation and validation
            const { paymentService } = await Promise.resolve().then(() => __importStar(require('./payment.service')));
            const { PaymentMethod } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
            // Map dynamic payment codes to PaymentMethod enum
            // e.g., 'DEBIT'/'CREDIT' -> 'CARD', 'EFECTIVO' -> 'CASH'
            const mapToPaymentMethod = (code) => {
                const codeUpper = code.toUpperCase();
                // Direct enum matches
                if (codeUpper in PaymentMethod) {
                    return PaymentMethod[codeUpper];
                }
                // Common mappings for dynamic codes
                if (['DEBIT', 'CREDIT', 'DEBITO', 'CREDITO', 'TARJETA'].includes(codeUpper)) {
                    return PaymentMethod.CARD;
                }
                if (['EFECTIVO'].includes(codeUpper)) {
                    return PaymentMethod.CASH;
                }
                if (['TRANSFERENCIA', 'BANCO'].includes(codeUpper)) {
                    return PaymentMethod.TRANSFER;
                }
                if (['MERCADOPAGO', 'MP', 'QR'].includes(codeUpper)) {
                    return PaymentMethod.QR_INTEGRATED;
                }
                // Default to CASH for unknown codes
                console.warn(`Unknown payment code "${code}" - defaulting to CASH`);
                return PaymentMethod.CASH;
            };
            const paymentInputs = payments.map(p => ({
                method: mapToPaymentMethod(p.method),
                amount: p.amount
            }));
            const paymentResult = paymentService.processPayments(Number(order.total), shift.id, undefined, paymentInputs);
            // DEBUG: Log payment calculation details
            console.log(`[CloseTable] Order #${order.id} - Total: ${order.total}, Paid: ${paymentResult.totalPaid}, isFullyPaid: ${paymentResult.isFullyPaid}, Status: ${paymentResult.paymentStatus}`);
            console.log(`[CloseTable] Payments received:`, paymentInputs);
            // 4. Register payments
            if (paymentResult.paymentsToCreate.length > 0) {
                await tx.payment.createMany({
                    data: paymentResult.paymentsToCreate.map(p => ({
                        ...p,
                        orderId: order.id
                    }))
                });
            }
            // 5. Update order status
            await tx.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: paymentResult.paymentStatus,
                    status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
                    closedAt: paymentResult.isFullyPaid ? new Date() : null
                }
            });
            // 6. Free table only if fully paid
            if (paymentResult.isFullyPaid) {
                console.log(`[CloseTable] Freeing table ${tableId}`);
                await tx.table.update({
                    where: { id: tableId },
                    data: {
                        status: 'FREE',
                        currentOrderId: null
                    }
                });
            }
            else {
                console.log(`[CloseTable] Table ${tableId} NOT freed - payment incomplete`);
            }
            return {
                orderId: order.id,
                total: Number(order.total),
                paid: paymentResult.totalPaid,
                status: paymentResult.paymentStatus
            };
        });
    }
}
exports.TableService = TableService;
exports.tableService = new TableService();
//# sourceMappingURL=table.service.js.map