"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseOrderService = exports.PurchaseOrderService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const stockMovement_service_1 = require("./stockMovement.service");
const stockService = new stockMovement_service_1.StockMovementService();
class PurchaseOrderService {
    /**
     * Get all purchase orders with supplier info
     */
    async getAll(status) {
        const whereClause = status ? { status } : {};
        return await prisma_1.prisma.purchaseOrder.findMany({
            where: whereClause,
            include: {
                supplier: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Get purchase order by ID with all details
     */
    async getById(id) {
        const order = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: {
                        ingredient: {
                            select: { id: true, name: true, unit: true }
                        }
                    }
                }
            }
        });
        if (!order)
            throw new errors_1.NotFoundError('Purchase Order');
        return order;
    }
    /**
     * Generate next order number
     */
    async getNextOrderNumber() {
        const lastOrder = await prisma_1.prisma.purchaseOrder.findFirst({
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
        });
        return (lastOrder?.orderNumber ?? 0) + 1;
    }
    /**
     * Create a new purchase order
     */
    async create(data) {
        // Validate supplier exists
        const supplier = await prisma_1.prisma.supplier.findUnique({
            where: { id: data.supplierId }
        });
        if (!supplier || !supplier.isActive) {
            throw new errors_1.NotFoundError('Supplier');
        }
        // Validate items
        if (!data.items || data.items.length === 0) {
            throw new errors_1.ValidationError('La orden debe tener al menos un item');
        }
        // Validate all ingredients exist
        const ingredientIds = data.items.map(i => i.ingredientId);
        const ingredients = await prisma_1.prisma.ingredient.findMany({
            where: { id: { in: ingredientIds } }
        });
        if (ingredients.length !== ingredientIds.length) {
            throw new errors_1.ValidationError('Uno o más ingredientes no existen');
        }
        // Calculate totals
        let subtotal = 0;
        for (const item of data.items) {
            subtotal += item.quantity * item.unitCost;
        }
        const orderNumber = await this.getNextOrderNumber();
        return await prisma_1.prisma.purchaseOrder.create({
            data: {
                orderNumber,
                supplierId: data.supplierId,
                status: 'PENDING',
                subtotal,
                total: subtotal, // No taxes for now
                notes: data.notes ?? null,
                items: {
                    create: data.items.map(item => ({
                        ingredientId: item.ingredientId,
                        quantity: item.quantity,
                        unitCost: item.unitCost
                    }))
                }
            },
            include: {
                supplier: true,
                items: {
                    include: {
                        ingredient: true
                    }
                }
            }
        });
    }
    /**
     * Update purchase order status
     */
    async updateStatus(id, status) {
        const order = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id }
        });
        if (!order)
            throw new errors_1.NotFoundError('Purchase Order');
        if (order.status === 'RECEIVED') {
            throw new errors_1.ConflictError('No se puede modificar una orden ya recibida');
        }
        if (order.status === 'CANCELLED') {
            throw new errors_1.ConflictError('No se puede modificar una orden cancelada');
        }
        return await prisma_1.prisma.purchaseOrder.update({
            where: { id },
            data: { status }
        });
    }
    /**
     * Receive purchase order - updates stock
     */
    async receivePurchaseOrder(id) {
        return await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Get order with items
            const order = await tx.purchaseOrder.findUnique({
                where: { id },
                include: {
                    items: {
                        include: {
                            ingredient: true
                        }
                    }
                }
            });
            if (!order)
                throw new errors_1.NotFoundError('Purchase Order');
            if (order.status === 'RECEIVED') {
                throw new errors_1.ConflictError('La orden ya fue recibida');
            }
            if (order.status === 'CANCELLED') {
                throw new errors_1.ConflictError('No se puede recibir una orden cancelada');
            }
            // 2. Create stock movements for each item
            for (const item of order.items) {
                await stockService.register(item.ingredientId, client_1.StockMoveType.PURCHASE, Number(item.quantity), `Orden de Compra #${order.orderNumber}`, tx);
            }
            // 3. Mark as received
            return await tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: 'RECEIVED',
                    receivedAt: new Date()
                },
                include: {
                    supplier: true,
                    items: {
                        include: {
                            ingredient: true
                        }
                    }
                }
            });
        });
    }
    /**
     * Cancel purchase order
     */
    async cancel(id) {
        const order = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id }
        });
        if (!order)
            throw new errors_1.NotFoundError('Purchase Order');
        if (order.status === 'RECEIVED') {
            throw new errors_1.ConflictError('No se puede cancelar una orden ya recibida');
        }
        return await prisma_1.prisma.purchaseOrder.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
    }
    /**
     * Delete purchase order (only if PENDING)
     */
    async delete(id) {
        const order = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id }
        });
        if (!order)
            throw new errors_1.NotFoundError('Purchase Order');
        if (order.status !== 'PENDING') {
            throw new errors_1.ConflictError('Solo se pueden eliminar órdenes pendientes');
        }
        await prisma_1.prisma.purchaseOrder.delete({
            where: { id }
        });
    }
}
exports.PurchaseOrderService = PurchaseOrderService;
exports.purchaseOrderService = new PurchaseOrderService();
//# sourceMappingURL=purchaseOrder.service.js.map