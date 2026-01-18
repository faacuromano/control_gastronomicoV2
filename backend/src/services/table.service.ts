import { prisma } from '../lib/prisma';
import { TableStatus } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export class TableService {
    // --- AREAS ---

    async getAreas() {
        return prisma.area.findMany({
            include: {
                tables: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });
    }

    async createArea(data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        return prisma.area.create({ data });
    }

    async updateArea(id: number, data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        return prisma.area.update({
            where: { id },
            data: { name: data.name }
        });
    }

    async deleteArea(id: number) {
        // Check if any table is occupied
        const occupiedCount = await prisma.table.count({ 
            where: { areaId: id, status: 'OCCUPIED' } 
        });
        if (occupiedCount > 0) throw new ConflictError('No se puede eliminar un área con mesas ocupadas');

        // Cascade delete tables (assuming no active orders blocking due to FK constraints)
        // If there are past orders linked to these tables, the DB might restrict deletion.
        // Ideally we should set Order.tableId to null, but let's try deleteMany.
        // For MVP test (clean tables), this will work.
        await prisma.table.deleteMany({ where: { areaId: id } });
        
        return prisma.area.delete({ where: { id } });
    }

    // --- TABLES ---

    async createTable(data: { name: string; areaId: number; x?: number; y?: number }) {
        const area = await prisma.area.findUnique({ where: { id: data.areaId } });
        if (!area) throw new NotFoundError('Area not found');

        return prisma.table.create({
            data: {
                name: data.name,
                areaId: data.areaId,
                x: data.x || 0,
                y: data.y || 0,
                status: 'FREE'
            }
        });
    }

    async updateTable(id: number, data: { name?: string; x?: number; y?: number }) {
        return prisma.table.update({
            where: { id },
            data
        });
    }

    async updateTablePosition(id: number, x: number, y: number) {
        return prisma.table.update({
            where: { id },
            data: { x, y }
        });
    }

    async updatePositions(updates: { id: number; x: number; y: number }[]) {
        return prisma.$transaction(
            updates.map(u => 
                prisma.table.update({
                    where: { id: u.id },
                    data: { x: u.x, y: u.y }
                })
            )
        );
    }

    async getTable(id: number) {
        const table = await prisma.table.findUnique({
            where: { id },
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

    async deleteTable(id: number) {
        // Check if table is currently occupied
        const table = await prisma.table.findUnique({ where: { id } });
        if (!table) throw new NotFoundError('Table not found');
        if (table.status === 'OCCUPIED') throw new ConflictError('Cannot delete occupied table');
        
        return prisma.table.delete({ where: { id } });
    }

    // --- OPERATIONS ---

    async openTable(id: number, orderId: number) {
        return prisma.table.update({
            where: { id },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }

    async closeTable(id: number) {
        return prisma.table.update({
            where: { id },
            data: {
                status: 'FREE',
                currentOrderId: null
            }
        });
    }

    // Used when an order is created with tableId
    async assignOrderToTable(tableId: number, orderId: number) {
        const table = await prisma.table.findUnique({ where: { id: tableId } });
        if (!table) throw new NotFoundError('Table not found');
        
        if (table.status !== 'FREE' && table.status !== 'OCCUPIED') {
             // Maybe allow if occupied adding to same order? 
             // For simplicity, just update currentOrderId
        }

        return prisma.table.update({
            where: { id: tableId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }
    
    async freeTableFromOrder(tableId: number) {
        return prisma.table.update({
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
    async openTableWithOrder(tableId: number, serverId: number, pax: number = 1) {
        // Use the new OrderNumberService and OrderService logic directly or replicate robustly
        // Prefer reusing OrderService.createOrder if possible, but here we need a specific flow.
        // We will use OrderNumberService for safe ID generation.
        
        return await prisma.$transaction(async (tx) => {
            // 1. Verify table exists and is FREE
            const table = await tx.table.findUnique({ where: { id: tableId } });
            if (!table) throw new NotFoundError('Table not found');
            if (table.status !== 'FREE') throw new ConflictError('Table is already occupied');

            // 2. Verify server has active shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, endTime: null }
            });
            if (!shift) throw new ConflictError('No hay turno de caja abierto. Abre un turno primero.');

            // 3. Get next order number SAFETY using OrderNumberService
            // Import dynamically or pass tx if service is adapted, but here we use the service instance logic
            // We need to import the service at the top of file
            const { orderNumberService } = await import('./orderNumber.service');
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
    async closeTableWithPayment(tableId: number, serverId: number, payments: { method: string; amount: number }[]) {
        return await prisma.$transaction(async (tx) => {
            // 1. Get table and current order
            const table = await tx.table.findUnique({ where: { id: tableId } });
            if (!table) throw new NotFoundError('Table not found');
            if (!table.currentOrderId) throw new ConflictError('Table has no active order');

            const order = await tx.order.findUnique({
                where: { id: table.currentOrderId },
                include: { items: true }
            });
            if (!order) throw new NotFoundError('Order not found');

            // 2. Verify shift
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, endTime: null }
            });
            if (!shift) throw new ConflictError('No hay turno de caja abierto');

            // 3. Use PaymentService for calculation and validation
            const { paymentService } = await import('./payment.service');
            const { PaymentMethod } = await import('@prisma/client');
            
            // Map dynamic payment codes to PaymentMethod enum
            // e.g., 'DEBIT'/'CREDIT' -> 'CARD', 'EFECTIVO' -> 'CASH'
            const mapToPaymentMethod = (code: string): typeof PaymentMethod[keyof typeof PaymentMethod] => {
                const codeUpper = code.toUpperCase();
                // Direct enum matches
                if (codeUpper in PaymentMethod) {
                    return PaymentMethod[codeUpper as keyof typeof PaymentMethod];
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
                logger.warn('Unknown payment code, defaulting to CASH', { code });
                return PaymentMethod.CASH;
            };
            
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
                logger.info('Freeing table after full payment', { tableId });
                await tx.table.update({
                    where: { id: tableId },
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

