/**
 * @fileoverview Servicio de gestion de mesas y areas del restaurante.
 * Maneja el CRUD de areas y mesas, operaciones de apertura/cierre de mesas,
 * y el flujo completo de abrir mesa con orden vacia y cerrar mesa con pago.
 * Las mesas se organizan en areas (ej: salon, terraza, barra) y tienen
 * posiciones X/Y para un mapa visual en el frontend.
 *
 * @module services/table.service
 */

import { prisma } from '../lib/prisma';
import { TableStatus, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getBusinessDate } from '../utils/businessDate';

export class TableService {
    // --- AREAS ---

    /**
     * Obtiene todas las areas del restaurante con sus mesas.
     * Limitado a 100 areas (suficiente para cualquier restaurante).
     */
    async getAreas(tenantId: number) {
        return prisma.area.findMany({
            where: { tenantId },
            include: {
                tables: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' },
            take: 100
        });
    }

    /**
     * Crea una nueva area en el restaurante (ej: "Terraza", "Salon VIP").
     */
    async createArea(tenantId: number, data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        return prisma.area.create({
            data: {
                ...data,
                tenantId
            }
        });
    }

    /**
     * Actualiza el nombre de un area existente.
     */
    async updateArea(id: number, tenantId: number, data: { name: string }) {
        if (!data.name) throw new ValidationError('Area name is required');
        // Verificar propiedad: findFirst es mas seguro que depender de que update lance si no encuentra
        const exists = await prisma.area.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Area not found');

        return prisma.area.updateMany({
            where: { id, tenantId },
            data: { name: data.name }
        });
    }

    /**
     * Elimina un area y todas sus mesas.
     * No permite eliminar si alguna mesa esta ocupada (tiene orden activa).
     */
    async deleteArea(id: number, tenantId: number) {
        // Verificar propiedad del area
        const area = await prisma.area.findFirst({ where: { id, tenantId } });
        if (!area) throw new NotFoundError('Area not found');

        // Verificar que no haya mesas ocupadas en el area
        const occupiedCount = await prisma.table.count({
            where: { areaId: id, tenantId, status: 'OCCUPIED' }
        });
        if (occupiedCount > 0) throw new ConflictError('Cannot delete an area with occupied tables');

        // Eliminacion en cascada: primero mesas, luego area
        await prisma.table.deleteMany({ where: { areaId: id, tenantId } });

        return prisma.area.deleteMany({ where: { id, tenantId } });
    }

    // --- MESAS ---

    /**
     * Crea una nueva mesa en un area del restaurante.
     * Verifica que el area pertenezca al tenant antes de crear.
     */
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

    /**
     * Actualiza datos de una mesa (nombre, posicion).
     */
    async updateTable(id: number, tenantId: number, data: { name?: string; x?: number; y?: number }) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id, tenantId },
            data
        });
    }

    /**
     * Actualiza la posicion X/Y de una mesa en el mapa visual.
     */
    async updateTablePosition(id: number, tenantId: number, x: number, y: number) {
        const exists = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('Table not found');

        return prisma.table.updateMany({
            where: { id, tenantId },
            data: { x, y }
        });
    }

    /**
     * Actualiza posiciones de multiples mesas en una transaccion.
     * Se usa cuando el usuario arrastra mesas en el mapa visual y guarda el layout.
     * updateMany es silencioso si no encuentra la mesa (proteccion contra IDOR en batch).
     */
    async updatePositions(tenantId: number, updates: { id: number; x: number; y: number }[]) {
        return prisma.$transaction(async (tx) => {
            for (const u of updates) {
                // updateMany con tenantId: silencioso si no pertenece al tenant (seguro para batch)
                await tx.table.updateMany({
                    where: { id: u.id, tenantId },
                    data: { x: u.x, y: u.y }
                });
            }
        });
    }

    /**
     * Obtiene una mesa con sus ordenes abiertas e items.
     * Se usa para mostrar el detalle de una mesa en la vista de salon.
     */
    async getTable(id: number, tenantId: number) {
        const table = await prisma.table.findFirst({
            where: { id, tenantId },
            include: {
                orders: {
                    where: { status: 'OPEN' },
                    include: { items: true } // Informacion basica de items
                }
            }
        });
        if (!table) throw new NotFoundError('Table not found');
        return table;
    }

    /**
     * Elimina una mesa. No permite eliminar si esta ocupada.
     */
    async deleteTable(id: number, tenantId: number) {
        // Verificar que la mesa exista y no este ocupada
        const table = await prisma.table.findFirst({ where: { id, tenantId } });
        if (!table) throw new NotFoundError('Table not found');
        if (table.status === 'OCCUPIED') throw new ConflictError('Cannot delete occupied table');

        return prisma.table.deleteMany({ where: { id, tenantId } });
    }

    // --- OPERACIONES BASICAS ---

    /**
     * Marca una mesa como ocupada y le asigna una orden.
     */
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

    /**
     * Libera una mesa (marca como FREE y desvincula la orden).
     */
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

    /**
     * Asigna una orden existente a una mesa (se usa al crear ordenes con tableId).
     */
    async assignOrderToTable(tableId: number, orderId: number, tenantId: number) {
        const table = await prisma.table.findFirst({
            where: {
                id: tableId,
                tenantId
            }
        });
        if (!table) throw new NotFoundError('Table not found');

        if (table.status !== 'FREE' && table.status !== 'OCCUPIED') {
             // Podria permitirse si esta ocupada y se agrega a la misma orden
             // Por simplicidad, simplemente actualizamos el currentOrderId
        }

        return prisma.table.updateMany({
            where: { id: tableId, tenantId },
            data: {
                status: 'OCCUPIED',
                currentOrderId: orderId
            }
        });
    }

    /**
     * Libera una mesa de su orden actual.
     * Se usa cuando una orden se cancela o se cierra sin mesa.
     */
    async freeTableFromOrder(tableId: number, tenantId: number) {
        // Verificar que la mesa pertenezca al tenant antes de actualizar
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

    // --- OPERACIONES COMPLETAS (con gestion de ordenes) ---

    // --- OPERACIONES COMPLETAS (con gestion de ordenes) ---

    /**
     * Abre una mesa creando una orden vacia y marcandola como OCCUPIED.
     *
     * Flujo dentro de una transaccion atomica:
     * 1. Verifica que la mesa exista y este FREE
     * 2. Verifica que el mesero tenga un turno de caja activo
     * 3. Genera el numero de orden atomicamente usando OrderNumberService
     * 4. Crea una orden vacia (sin items) para la mesa
     * 5. Marca la mesa como OCCUPIED con la nueva orden
     */
    async openTableWithOrder(tableId: number, serverId: number, pax: number = 1, tenantId: number) {
        return await prisma.$transaction(async (tx) => {
            // 1. Verificar que la mesa exista y este libre
            const table = await tx.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found');
            if (table.status !== 'FREE') throw new ConflictError('Table is already occupied');

            // 2. Verificar que el mesero tenga un turno de caja activo
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, tenantId, endTime: null }
            });
            if (!shift) throw new ConflictError('No active cash shift. Open a shift first.');

            // 3. Obtener siguiente numero de orden y businessDate atomicamente
            // FIX P2002: Usar el businessDate retornado por getNextOrderNumber para consistencia
            const { orderNumberService } = await import('./orderNumber.service');
            const { businessDateService } = await import('./businessDate.service');

            const businessDate = await businessDateService.determineBusinessDate(tenantId, serverId);

            const { orderNumber } = await orderNumberService.getNextOrderNumber(tx, tenantId, businessDate);

            // 4. Crear orden vacia (sin items, el mesero los agrega despues)
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
                    businessDate // FIX P2002: Usar businessDate atomico de getNextOrderNumber
                } as Prisma.OrderUncheckedCreateInput
            });

            // 5. Marcar mesa como ocupada con la nueva orden
            // SEGURO: tx.table.findFirst en L225 verifica propiedad del tenant
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
     * Cierra una mesa procesando el pago y liberando la mesa si esta completamente pagada.
     *
     * Flujo dentro de una transaccion atomica:
     * 1. Obtiene mesa y su orden activa
     * 2. Verifica turno de caja del mesero
     * 3. Procesa los pagos usando PaymentService (validacion y calculo de estado)
     * 4. Registra los pagos en la base de datos
     * 5. Actualiza el estado de la orden (CONFIRMED si pagada completa)
     * 6. Libera la mesa solo si el pago fue total
     */
    async closeTableWithPayment(tableId: number, serverId: number, payments: { method: string; amount: number }[], tenantId: number) {
        return await prisma.$transaction(async (tx) => {
            // 1. Obtener mesa y su orden actual
            const table = await tx.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found');
            if (!table.currentOrderId) throw new ConflictError('Table has no active order');

            const order = await tx.order.findFirst({
                where: { id: table.currentOrderId!, tenantId },
                include: { items: true }
            });
            if (!order) throw new NotFoundError('Order not found');

            // 2. Verificar turno de caja activo del mesero
            const shift = await tx.cashShift.findFirst({
                where: { userId: serverId, tenantId, endTime: null }
            });
            if (!shift) throw new ConflictError('No active cash shift');

            // 3. Usar PaymentService para calculo y validacion de pagos
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

            // DEBUG: Log de detalles del calculo de pago
            logger.debug('CloseTable payment calculation', { orderId: order.id, total: order.total, paid: paymentResult.totalPaid, isFullyPaid: paymentResult.isFullyPaid, status: paymentResult.paymentStatus });
            logger.debug('CloseTable payments received', { payments: paymentInputs });

            // 4. Registrar los pagos en la base de datos
            if (paymentResult.paymentsToCreate.length > 0) {
                 await tx.payment.createMany({
                    data: paymentResult.paymentsToCreate.map(p => ({
                        ...p,
                        tenantId,
                        orderId: order.id
                    }))
                });
            }

            // 5. Actualizar estado de la orden segun resultado del pago
            // SEGURO: tx.order.findFirst en L284 verifica propiedad del tenant
            await tx.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: paymentResult.paymentStatus,
                    status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
                    closedAt: paymentResult.isFullyPaid ? new Date() : null
                }
            });

            // 6. Liberar mesa solo si el pago fue total
            if (paymentResult.isFullyPaid) {
                logger.info('Freeing table after full payment', { tableId });
                // SEGURO: tx.table.findFirst en L280 verifica propiedad del tenant
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
