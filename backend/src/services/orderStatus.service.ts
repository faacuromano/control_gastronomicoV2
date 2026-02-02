/**
 * @fileoverview Servicio de gestión de estados de orden con validación de máquina de estados.
 * Controla las transiciones de estado de las órdenes y aplica reglas de negocio
 * para garantizar que solo se permitan cambios de estado válidos.
 *
 * @module services/orderStatus.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';
import { auditService } from './audit.service';
import { ValidationError, NotFoundError } from '../utils/errors';

/**
 * Estructura de datos para actualizar el estado de una orden.
 * Incluye el nuevo estado y opcionalmente la fecha de cierre.
 */
interface OrderUpdateData {
    status: OrderStatus;
    closedAt?: Date;
}

/**
 * Servicio para gestionar las transiciones de estado de las órdenes.
 * Implementa una máquina de estados finita que define qué transiciones
 * son válidas desde cada estado, previniendo cambios ilógicos o peligrosos.
 */
export class OrderStatusService {

    /**
     * Mapa de transiciones válidas entre estados de orden.
     * Formato: { ESTADO_ORIGEN: [ESTADOS_DESTINO_PERMITIDOS] }
     *
     * Cada estado tiene un conjunto definido de estados a los que puede transicionar.
     * Esto evita situaciones como cancelar una orden ya entregada o preparar una cancelada.
     */
    private readonly allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.OPEN]: [OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED]: [OrderStatus.OPEN, OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
        [OrderStatus.IN_PREPARATION]: [OrderStatus.OPEN, OrderStatus.PREPARED, OrderStatus.CANCELLED],
        [OrderStatus.PREPARED]: [OrderStatus.OPEN, OrderStatus.IN_PREPARATION, OrderStatus.ON_ROUTE, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.ON_ROUTE]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED]: [OrderStatus.OPEN], // Se puede reabrir si se agregan mas items
        [OrderStatus.CANCELLED]: [] // Estado terminal: no se permiten mas transiciones
    };

    /**
     * Estados terminales que cierran la orden definitivamente.
     * Cuando una orden alcanza uno de estos estados, se registra la fecha de cierre.
     */
    private readonly terminalStatuses: OrderStatus[] = [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED
    ];

    /**
     * Actualiza el estado de una orden y notifica al KDS via WebSocket.
     * Incluye validacion de maquina de estados para prevenir transiciones invalidas.
     *
     * Flujo:
     * 1. Obtiene el estado actual de la orden
     * 2. Valida que la transicion sea permitida segun la maquina de estados
     * 3. Si el estado es terminal, registra la fecha de cierre
     * 4. Si el estado es PREPARED, marca todos los items pendientes como READY
     * 5. Actualiza la orden usando updateMany con tenantId (defensa en profundidad)
     * 6. Si se cancela y tiene mesa asignada, libera la mesa
     * 7. Notifica al KDS para actualizar pantallas en tiempo real
     */
    async updateStatus(orderId: number, status: OrderStatus, tenantId: number) {
        // Obtener el estado actual de la orden para validar la transicion
        const currentOrder = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            select: { status: true }
        });

        if (!currentOrder) {
            throw new NotFoundError(`Order ${orderId}`);
        }

        const currentStatus = currentOrder.status as OrderStatus;
        const allowedNextStatuses = this.allowedTransitions[currentStatus] || [];

        // Validar transicion: bloquear cambios de estado invalidos
        if (!allowedNextStatuses.includes(status)) {
            throw new ValidationError(
                `Invalid order status transition from ${currentStatus} to ${status}. ` +
                `Allowed transitions: ${allowedNextStatuses.join(', ')}`
            );
        }

        // Construir los datos de actualizacion
        const updateData: OrderUpdateData = { status };

        // Registrar fecha de cierre automaticamente si es un estado terminal
        if (this.terminalStatuses.includes(status)) {
            updateData.closedAt = new Date();
        }

        // Si el estado es PREPARED (Listo), marcar todos los items no servidos como READY
        // Esto sincroniza el estado de los items con el estado general de la orden
        if (status === OrderStatus.PREPARED) {
            await prisma.orderItem.updateMany({
                where: {
                    orderId,
                    tenantId,
                    status: { notIn: ['SERVED', 'READY'] }
                },
                data: { status: 'READY' }
            });
        }

        // Usar updateMany con tenantId para defensa en profundidad (fix P1-008)
        // Esto garantiza aislamiento multi-tenant incluso si el orderId fuera manipulado
        const updateResult = await prisma.order.updateMany({
            where: { id: orderId, tenantId },
            data: updateData
        });
        if (updateResult.count === 0) {
            throw new NotFoundError(`Order ${orderId}`);
        }

        // Obtener la orden actualizada con sus relaciones para la notificacion al KDS
        const order = await prisma.order.findFirstOrThrow({
            where: { id: orderId, tenantId },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                table: true
            }
        });

        // Liberar la mesa si la orden fue cancelada y tenia una mesa asignada
        if (status === OrderStatus.CANCELLED && order.tableId) {
            await prisma.table.updateMany({
                where: { id: order.tableId, tenantId, currentOrderId: orderId },
                data: { status: 'FREE', currentOrderId: null }
            });
        }

        // Notificar al KDS via WebSocket para actualizar pantallas de cocina
        kdsService.broadcastOrderUpdate(order);

        return order;
    }

    /**
     * Verifica si una transicion de estado es valida segun la maquina de estados.
     * Util para validaciones previas en la UI antes de intentar el cambio.
     */
    isValidTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
        const allowed = this.allowedTransitions[fromStatus] || [];
        return allowed.includes(toStatus);
    }

    /**
     * Obtiene los estados destino permitidos para un estado dado.
     * Se usa en el frontend para mostrar solo las opciones validas al usuario.
     */
    getAllowedTransitions(currentStatus: OrderStatus): OrderStatus[] {
        return this.allowedTransitions[currentStatus] || [];
    }
}

export const orderStatusService = new OrderStatusService();
