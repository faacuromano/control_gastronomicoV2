import { prisma } from '../lib/prisma';
import { TableStatus, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getBusinessDate } from '../utils/businessDate';

export class TableService {
    // --- AREAS ---

    async getAreas(tenantId: number) {
        return prisma.area.findMany({
            where: { tenantId },
            include: {
                tables: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });
    }

    async createArea(tenantId: number, data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        return prisma.area.create({ 
            data: {
                ...data,
                tenantId
            }
        });
    }

    async updateArea(id: number, tenantId: number, data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        // Ownership check implicit in update where clause but update throws if not found
        // Safer to findFirst
        const exists = await prisma.area.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Area not found');

        return prisma.area.updateMany({
            where: { id, tenantId },
            data: { name: data.name }
        });
    }

    async deleteArea(id: number, tenantId: number) {
        // Check ownership
        const area = await prisma.area.findFirst({ where: { id, tenantId } });
        if (!area) throw new NotFoundError('Area not found');

        // Check if any table is occupied
        const occupiedCount = await prisma.table.count({
            where: { areaId: id, tenantId, status: 'OCCUPIED' }
        });
        if (occupiedCount > 0) throw new ConflictError('No se puede eliminar un área con mesas ocupadas');

        // Cascade delete tables
        await prisma.table.deleteMany({ where: { areaId: id, tenantId } });

        return prisma.area.deleteMany({ where: { id, tenantId } });
    }

    // --- TABLES ---

    async createTable(tenantId: number, data: { name: string; areaId: number; x?: number; y?: number }) {
        const area = await prisma.area.findFirst({ where: { id: data.areaId, tenantId } });
        if (!area) throw new NotFoundError('Area not found or access denied');

        return prisma.table.create({
            data: {
                tenantId,
                name: data.name,
                areaId: data.areaId,
                x: data.x || 0,
                y: data.y || 0,
                status: 'FREE'
            }
        });
    }

    async updateTable(id: number, tenantId: number, data: { name?: string; x?: number; y?: number }) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');
        
        return prisma.table.updateMany({
            where: { id, tenantId },
            data
        });
    }

    async updateTablePosition(id: number, tenantId: number, x: number, y: number) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id, tenantId },
            data: { x, y }
        });
    }

    async updatePositions(tenantId: number, updates: { id: number; x: number; y: number }[]) {
        // Verify all tables belong to tenant
        // Optimization: For batched updates, we assume frontend is correct but safety requires check
        // We will loop and update only if tenant matches.
        return prisma.$transaction(async (tx) => {
            for (const u of updates) {
                // Determine if table belongs to tenant - can check existance or use updateMany
                // updateMany is silent if not found, distinct from update which throws.
                // Silent update is fine for batch ops if IDOR is concern.
                await tx.table.updateMany({
                    where: { id: u.id, tenantId },
                    data: { x: u.x, y: u.y }
                });
            }
        });
    }

    async getTable(id: number, tenantId: number) {
        const table = await prisma.table.findFirst({
            where: { id, tenantId },
            include: {
                orders: {
                    where: { status: 'OPEN' },
                    include: { items: true } // Basic info
                }
            }
        });
        if (!table) throw new NotFoundError('Table not found');
        return table;
    }

    async deleteTable(id: number, tenantId: number) {
        // Check if table is currently occupied
        const table = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!table) throw new NotFoundError('Table not found');
        if (table.status === 'OCCUPIED') throw new ConflictError('Cannot delete occupied table');
        
        return prisma.table.deleteMany({ where: { id, tenantId } });
    }

    // --- OPERATIONS ---

    async openTable(id: number, orderId: number, tenantId: number) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id, tenantId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }

    async closeTable(id: number, tenantId: number) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id, tenantId },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }

    // Used when an order is created with tableId
    async assignOrderToTable(tableId: number, orderId: number, tenantId: number) {
        const table = await prisma.table.findFirst({
            where: {
                id: tableId,
                tenantId
            }
        });
        if (!table) throw new NotFoundError('Table not found');

        if (table.status !== 'FREE' && table.status !== 'OCCUPIED') {
             // Maybe allow if occupied adding to same order?
             // For simplicity, just update currentOrderId
        }

        return prisma.table.updateMany({
            where: { id: tableId, tenantId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }

    async freeTableFromOrder(tableId: number, tenantId: number) {
        // Verify table belongs to tenant before updating
        const table = await prisma.table.findFirst({
            where: {
                id: tableId,
                tenantId
            }
        });
        if (!table) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id: tableId, tenantId },
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
    async openTableWithOrder(tableId: number, serverId: number, pax: number = 1, tenantId: number) {
        // Use the new OrderNumberService and OrderService logic directly or replicate robustly
        // Prefer reusing OrderService.createOrder if possible, but here we need a specific flow.
        // We will use OrderNumberService for safe ID generation.
        
        return await prisma.$transaction(async (tx) => {
            // 1. Verify table exists and is FREE
            const table = await tx.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found');
            if (table.status !== 'FREE') throw new ConflictError('Table is already occupied');

            // 2. Verify server has active shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, tenantId, endTime: null }
            });
            if (!shift) throw new ConflictError('No hay turno de caja abierto. Abre un turno primero.');

            // 3. Get next order number and atomic businessDate using OrderNumberService
            // FIX P2002: Use the businessDate returned by getNextOrderNumber for consistency
            const { orderNumberService } = await import('./orderNumber.service');
            const { businessDateService } = await import('./businessDate.service');
            
            const businessDate = await businessDateService.determineBusinessDate(tenantId, serverId);
            
            const { orderNumber } = await orderNumberService.getNextOrderNumber(tx, tenantId, businessDate);

            // 4. Create an empty order (no items)
            const order = await tx.order.create({
                data: {
                    tenantId,
                    orderNumber,
                    serverId,
                    tableId,
                    channel: 'WAITER_APP',
                    status: 'OPEN',
                    paymentStatus: 'PENDING',
                    subtotal: 0,
                    total: 0,
                    businessDate // FIX P2002: Use atomic businessDate from getNextOrderNumber
                } as Prisma.OrderUncheckedCreateInput
            });

            // 5. Update table to OCCUPIED
            // SAFE: tx.table.findFirst at L225 verifies tenant ownership
            await tx.table.updateMany({
                where: { id: tableId, tenantId },
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
    async closeTableWithPayment(tableId: number, serverId: number, payments: { method: string; amount: number }[], tenantId: number) {
        return await prisma.$transaction(async (tx) => {
            // 1. Get table and current order
            const table = await tx.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found');
            if (!table.currentOrderId) throw new ConflictError('Table has no active order');

            const order = await tx.order.findFirst({
                where: { id: table.currentOrderId!, tenantId },
                include: { items: true }
            });
            if (!order) throw new NotFoundError('Order not found');

            // 2. Verify shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, tenantId, endTime: null }
            });
            if (!shift) throw new ConflictError('No hay turno de caja abierto');

            // 3. Use PaymentService for calculation and validation
            const { paymentService } = await import('./payment.service');
            const { mapToPaymentMethod } = await import('../utils/paymentMethod');

            const paymentInputs = payments.map(p => ({
                method: mapToPaymentMethod(p.method),
                amount: p.amount
            }));

            const paymentResult = paymentService.processPayments(
                Number(order.total),
                shift.id,
                undefined,
                paymentInputs
            );

            // DEBUG: Log payment calculation details
            logger.debug('CloseTable payment calculation', { orderId: order.id, total: order.total, paid: paymentResult.totalPaid, isFullyPaid: paymentResult.isFullyPaid, status: paymentResult.paymentStatus });
            logger.debug('CloseTable payments received', { payments: paymentInputs });

            // 4. Register payments
            if (paymentResult.paymentsToCreate.length > 0) {
                 await tx.payment.createMany({
                    data: paymentResult.paymentsToCreate.map(p => ({
                        ...p,
                        tenantId,
                        orderId: order.id
                    }))
                });
            }

            // 5. Update order status
            // SAFE: tx.order.findFirst at L284 verifies tenant ownership
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
                logger.info('Freeing table after full payment', { tableId });
                // SAFE: tx.table.findFirst at L280 verifies tenant ownership
                await tx.table.updateMany({
                    where: { id: tableId, tenantId },
                    data: {
                        status: 'FREE',
                        currentOrderId: null
                    }
                });
            } else {
                logger.debug('Table NOT freed - payment incomplete', { tableId });
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

export const tableService = new TableService();

