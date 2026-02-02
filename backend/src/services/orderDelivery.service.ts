/**
 * @fileoverview Servicio de operaciones de delivery para ordenes.
 * Gestiona la asignacion de repartidores y las consultas de ordenes de delivery.
 *
 * Extraido del monolito order.service.ts como parte del refactoring DT-001
 * para mejorar la separacion de responsabilidades.
 *
 * @module services/orderDelivery.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';
import { NotFoundError } from '../utils/errors';

/**
 * Servicio para operaciones especificas de delivery.
 * Gestiona asignacion de repartidores y visibilidad de ordenes de delivery.
 */
export class OrderDeliveryService {

    /**
     * Asigna un repartidor a una orden.
     * Solo vincula el repartidor — no cambia el estado de la orden.
     * Para cambios de estado, usar OrderStatusService.
     *
     * Verifica que tanto la orden como el repartidor pertenezcan al mismo tenant
     * y que el repartidor este activo.
     */
    async assignDriver(orderId: number, driverId: number, tenantId: number) {
        // Verificar que la orden pertenezca al tenant
        const existingOrder = await prisma.order.findFirst({
            where: {
                id: orderId,
                tenantId
            }
        });

        if (!existingOrder) {
            throw new NotFoundError('Order');
        }

        // Verificar que el repartidor (User) pertenezca al tenant y este activo
        const driver = await prisma.user.findFirst({
            where: {
                id: driverId,
                tenantId,
                isActive: true
            }
        });

        if (!driver) {
            throw new NotFoundError('Driver');
        }

        // SEGURO: findFirst en L25 verifica propiedad del tenant antes del update
        const order = await prisma.order.update({
            where: { id: orderId },
            data: { driverId },
            include: {
                driver: true,
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                }
            }
        });

        // Transmitir actualizacion al KDS y dashboard de delivery
        kdsService.broadcastOrderUpdate(order);

        return order;
    }

    /**
     * Obtiene ordenes de delivery activas (incluyendo entregas del dia).
     * Usado por el dashboard de delivery para mostrar pedidos pendientes y recientes.
     *
     * Filtra solo ordenes con tipos de cumplimiento de delivery
     * (PLATFORM_DELIVERY, SELF_DELIVERY, TAKEAWAY) para excluir ordenes
     * de POS y DINE_IN del panel de delivery.
     */
    async getDeliveryOrders(tenantId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeDeliveryStatuses: OrderStatus[] = [
            OrderStatus.OPEN,
            OrderStatus.CONFIRMED,
            OrderStatus.IN_PREPARATION,
            OrderStatus.PREPARED,
            OrderStatus.ON_ROUTE
        ];

        return await prisma.order.findMany({
            where: {
                tenantId,
                // FIX: Solo mostrar ordenes con tipos de cumplimiento de delivery.
                // Esto excluye ordenes POS y DINE_IN del dashboard de delivery.
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                OR: [
                    { status: { in: activeDeliveryStatuses } },
                    {
                        status: OrderStatus.DELIVERED,
                        closedAt: { gte: today }
                    }
                ]
            },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, price: true } },
                        modifiers: { include: { modifierOption: { select: { id: true, name: true, priceOverlay: true } } } }
                    }
                },
                client: { select: { id: true, name: true, phone: true } },
                driver: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
    }
}

export const orderDeliveryService = new OrderDeliveryService();
