
/**
 * @fileoverview Servicio de gestion de ordenes (Fachada / Facade).
 * Orquesta la creacion, actualizacion y ciclo de vida completo de las ordenes.
 *
 * PATRON: Facade — Delega a servicios especializados para respetar el
 * Principio de Responsabilidad Unica (SRP):
 * - orderItem.service.ts     -> Validacion de items y calculo de precios
 * - orderKitchen.service.ts  -> Operaciones del KDS (Kitchen Display System)
 * - orderDelivery.service.ts -> Operaciones de delivery
 * - orderStatus.service.ts   -> Maquina de estados de la orden
 *
 * @module services/order.service
 * @see orderItem.service.ts - Validacion de items y calculo de precios
 * @see orderKitchen.service.ts - Operaciones KDS
 * @see orderDelivery.service.ts - Operaciones de delivery
 * @see orderStatus.service.ts - Transiciones de estado
 */

import { prisma } from '../lib/prisma';
import { Prisma, StockMoveType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { StockMovementService } from './stockMovement.service';
import { orderNumberService } from './orderNumber.service';
import { paymentService } from './payment.service';
import { kdsService } from './kds.service';
import { executeIfEnabled, isFeatureEnabled } from './featureFlags.service';
import { LoyaltyService } from './loyalty.service';
import { logger } from '../utils/logger';
import { getBusinessDate } from '../utils/businessDate';
import { auditService } from './audit.service';
import { mapToPaymentMethod } from '../utils/paymentMethod';
import {
    NotFoundError,
    ValidationError,
    ConflictError,
    BadRequestError
} from '../utils/errors';

// Servicios especializados extraidos del monolito original
import { orderKitchenService } from './orderKitchen.service';
import { orderDeliveryService } from './orderDelivery.service';
import { orderStatusService } from './orderStatus.service';
import { orderItemService } from './orderItem.service';

// Tipos centralizados en archivo dedicado
import type {
    OrderItemInput,
    DeliveryData,
    CreateOrderInput,
    OrderItemData,
    StockUpdate,
    OrderCreateData,
    AddPaymentsRequest,
    AddPaymentsResult
} from '../types/order.types';

// Re-exportar tipos para mantener compatibilidad hacia atras con importadores existentes
export type { OrderItemInput, DeliveryData, CreateOrderInput, AddPaymentsRequest, AddPaymentsResult };

const stockService = new StockMovementService();
const loyaltyService = new LoyaltyService();

export class OrderService {

  /**
   * Obtiene una orden por ID con todas sus relaciones (items, pagos, cliente, repartidor).
   * Verifica que la orden pertenezca al tenant.
   */
  async getById(id: number, tenantId: number) {
      return await prisma.order.findFirst({
          where: { id, tenantId },
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
   * Crea una nueva orden con items y pagos opcionales.
   *
   * Flujo completo dentro de una transaccion:
   * 1. Validar productos y calcular totales (con stock si esta habilitado)
   * 2. Determinar fecha de negocio robusta (del turno o del sistema)
   * 3. Generar numero de orden atomico (por tenant + fecha)
   * 4. Validar turno activo (opcional, permite ordenes sin turno)
   * 5. Procesar pagos
   * 6. Construir y crear la orden con items y modificadores anidados
   * 7. Descontar stock de ingredientes
   * 8. Actualizar estado de mesa a OCCUPIED
   * 9. Otorgar puntos de fidelizacion si corresponde
   * 10. Transmitir al KDS via WebSocket (fuera de la transaccion)
   */
  async createOrder(data: CreateOrderInput) {
    // Resolver Tenant ID primero (necesario para verificar feature flags)
    const tenantId = data.tenantId;
    if (!tenantId) throw new ValidationError('Tenant ID required');

    // Verificar si la validacion de stock esta habilitada ANTES de la transaccion
    const stockEnabled = await isFeatureEnabled('enableStock', tenantId);

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Validar productos y calcular totales (incluye validacion de stock si esta habilitado)
      const { itemDataList, stockUpdates, subtotal } = await this.validateAndCalculateItems(
        tx,
        data.items,
        tenantId,
        stockEnabled
      );

      // Aplicar descuento si se proporciona (desde el checkout del POS)
      const discountAmount = Math.min(Math.max(data.discount || 0, 0), subtotal);
      const total = subtotal - discountAmount;

      // 2. Determinar fecha de negocio robusta (del turno o del sistema)
      // FIX: Usar servicio dedicado que maneja graciosamente el escenario "Sin Turno"
      const businessDate = await import('../services/businessDate.service')
        .then(m => m.businessDateService.determineBusinessDate(tenantId, data.serverId));

      // 3. Generar numero de orden atomico, aislado por Tenant + Fecha
      const { orderNumber } = await orderNumberService.getNextOrderNumber(tx, tenantId, businessDate);

      // 4. Validar turno activo (opcional — BusinessDateService maneja el fallback,
      // pero queremos vincular el shiftId si existe)
      let shiftId: number | undefined;
      if (data.serverId) {
        const activeShift = await tx.cashShift.findFirst({
            where: { userId: data.serverId, tenantId, endTime: null }
        });
        if (activeShift) {
            shiftId = activeShift.id;
        } else {
             // No bloqueante: permitimos ordenes sin turno (ej: mesero temprano / delivery)
             // Pero lo registramos para visibilidad operativa
             logger.warn('ORDER_CREATED_WITHOUT_SHIFT', { serverId: data.serverId, businessDate });
        }
      }

      // 5. Procesar pagos (determinar metodo y calcular estado de pago)
      const singlePaymentMethod = data.paymentMethod === 'SPLIT' ? undefined :
          (data.paymentMethod ? mapToPaymentMethod(data.paymentMethod) : undefined);

      const splitPayments = data.payments?.map(p => ({
        ...p,
        method: mapToPaymentMethod(p.method)
      }));

      // NOTA: El procesamiento de pagos necesita turno activo para vincular el pago.
      // Si no hay turno, el pago queda "huerfano". Algunos establecimientos no usan turnos.
      // Nota: shiftId puede ser undefined si no existe turno activo.
      // Los pagos solo se persisten cuando shiftId es valido (ver guardia en linea ~204).
      const paymentResult = paymentService.processPayments(
        total,
        shiftId ?? null,
        singlePaymentMethod,
        splitPayments
      );

      // 6. Construir datos de creacion de orden (usando create sin check con FKs escalares)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Objeto dinamico construido condicionalmente, validado por Prisma en runtime
      const orderData: Prisma.OrderUncheckedCreateInput & Record<string, any> = {
        tenantId,
        orderNumber,
        channel: data.channel ?? 'POS',
        ...(data.channel === 'DELIVERY_APP' || (data.deliveryData?.address) ? {
          fulfillmentType: 'SELF_DELIVERY'
        } : {}),
        status: paymentResult.isFullyPaid ? 'CONFIRMED' : 'OPEN',
        paymentStatus: paymentResult.paymentStatus,
        subtotal,
        discount: discountAmount,
        total,
        businessDate,
        items: {
          create: itemDataList.map(item => ({
            tenantId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes ?? null,
            status: 'PENDING',
            ...(item.modifiers && item.modifiers.length > 0 ? {
                modifiers: {
                    create: item.modifiers.map(m => ({
                        tenantId,
                        modifierOptionId: m.id,
                        priceCharged: m.price
                    }))
                }
            } : {})
          }))
        }
      };

      // P1-01: Validar propiedad de FK antes de asignar a la orden (previene referencias cruzadas entre tenants)
      if (data.tableId) orderData.tableId = data.tableId;
      if (data.clientId) {
        const client = await tx.client.findFirst({ where: { id: data.clientId, tenantId } });
        if (!client) throw new NotFoundError(`Client ${data.clientId}`);
        orderData.clientId = data.clientId;
      }
      if (data.serverId) {
        const server = await tx.user.findFirst({ where: { id: data.serverId, tenantId } });
        if (!server) throw new NotFoundError(`Server ${data.serverId}`);
        orderData.serverId = data.serverId;
      }
      if (paymentResult.isFullyPaid && data.channel !== 'DELIVERY_APP') {
          orderData.closedAt = new Date();
      }

      if (data.deliveryData) {
          orderData.deliveryAddress = data.deliveryData.address;
          if (data.deliveryData.notes !== undefined) orderData.deliveryNotes = data.deliveryData.notes;
          if (data.deliveryData.driverId) orderData.driverId = data.deliveryData.driverId;
      }

      // Agregar pagos si existen (solo si hay turno activo para vincular)
      if (paymentResult.paymentsToCreate.length > 0 && shiftId) {
        orderData.payments = { create: paymentResult.paymentsToCreate.map(p => ({ ...p, tenantId })) };
      }

      // 7. Crear la orden en la base de datos
      const order = await tx.order.create({
        data: orderData,
        include: { items: true }
      });

      // 8. Descontar stock de ingredientes
      await this.processStockUpdates(tx, tenantId, stockUpdates, orderNumber);

      // 9. Actualizar estado de mesa a OCCUPIED y vincular la orden
      if (data.tableId) {
        const table = await tx.table.findFirst({ where: { id: data.tableId, tenantId } });
        if (!table) throw new NotFoundError(`Table ${data.tableId}`);

        if (table.status !== 'FREE') {
           throw new ConflictError('Table is currently occupied');
        }
        // SEGURO: tx.table.findFirst en L211 verifica propiedad del tenant
        await tx.table.updateMany({
          where: { id: data.tableId, tenantId },
          data: { status: 'OCCUPIED', currentOrderId: order.id }
        });
      }

      // 10. Otorgar puntos de fidelizacion si la orden esta pagada y tiene cliente
      let pointsAwarded = 0;
      if (data.clientId && paymentResult.isFullyPaid) {
          pointsAwarded = await loyaltyService.awardPoints(data.clientId, Number(total), tx, tenantId);
      }

      return { order, pointsAwarded };
    });

    if (txResult.pointsAwarded > 0) {
        logger.info('Loyalty points awarded', {
            clientId: data.clientId,
            points: txResult.pointsAwarded,
            orderId: txResult.order.id
        });
    }

    const order = txResult.order;

    // 11. Transmitir al KDS via WebSocket (fuera de la transaccion para no bloquear)
    if (order.status === 'CONFIRMED' || order.status === 'OPEN') {
        const fullOrder = await this.getById(order.id, tenantId);
        if (fullOrder) {
            kdsService.broadcastNewOrder(fullOrder);
        }
    }

    return order;
  }

  /**
   * Asigna un repartidor a una orden.
   * @delegates orderDeliveryService.assignDriver
   */
  async assignDriver(orderId: number, driverId: number, tenantId: number) {
    return orderDeliveryService.assignDriver(orderId, driverId, tenantId);
  }

  /**
   * Obtiene ordenes de delivery activas.
   * @delegates orderDeliveryService.getDeliveryOrders
   */
  async getDeliveryOrders(tenantId: number) {
    return orderDeliveryService.getDeliveryOrders(tenantId);
  }

  /**
   * Actualiza el estado de un item individual de la orden.
   * @delegates orderKitchenService.updateItemStatus
   */
  async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED', tenantId: number) {
    return orderKitchenService.updateItemStatus(itemId, status, tenantId);
  }

  /**
   * Marca todos los items de una orden como SERVED (servidos).
   * @delegates orderKitchenService.markAllItemsServed
   */
  async markAllItemsServed(orderId: number, tenantId: number) {
    return orderKitchenService.markAllItemsServed(orderId, tenantId);
  }

  /**
   * Valida productos y calcula totales de la orden.
   * @delegates orderItemService.validateAndCalculateItems
   */
  private async validateAndCalculateItems(
    tx: Prisma.TransactionClient,
    items: OrderItemInput[],
    tenantId: number,
    stockEnabled: boolean = true
  ) {
    return orderItemService.validateAndCalculateItems(tx, items, tenantId, stockEnabled);
  }

  /**
   * Procesa las deducciones de stock para los items de la orden.
   * @private
   *
   * @regla_negocio
   * Si el modulo de "Gestion de Stock" esta deshabilitado via TenantConfig (enableStock),
   * esta funcion sale graciosamente sin modificar el estado de la base de datos.
   * Esto previene corrupcion de stock cuando el modulo no esta activo.
   */
  private async processStockUpdates(
    tx: Prisma.TransactionClient,
    tenantId: number,
    stockUpdates: StockUpdate[],
    orderNumber: number
  ): Promise<void> {
    // Solo ejecutar si el modulo de Stock esta habilitado
    await executeIfEnabled('enableStock', async () => {
        // P1-05: Usar metodo batch para reducir queries N+1
        await stockService.registerBatch(
            stockUpdates,
            tenantId,
            StockMoveType.SALE,
            `Order #${orderNumber}`,
            tx
        );
    }, tenantId);
  }


  /**
   * Agrega pagos a una orden existente.
   *
   * PASO 2: CONTRATO DE INTERFAZ
   * -----------------------------
   * @param {number} orderId - ID de la orden (debe ser entero positivo > 0)
   * @param {AddPaymentsRequest} request - Datos del pago con flag opcional closeOrder
   * @param {number} tenantId - ID del tenant para aislamiento multi-tenant (CRITICO)
   * @param {number} userId - ID del usuario autenticado para registro de auditoria
   * @param {number} [shiftId] - ID del turno de caja activo (opcional, se intenta resolver)
   * @param {object} [auditContext] - Contexto adicional de auditoria (IP, User-Agent)
   *
   * @returns {Promise<AddPaymentsResult>} Resultado con detalles de pago y estado
   *
   * @throws {NotFoundError} - Orden no encontrada o pertenece a otro tenant
   * @throws {ValidationError} - Montos invalidos (cero, negativo, o sobrepago excesivo)
   * @throws {ConflictError} - Orden ya pagada completamente o cancelada
   * @throws {BadRequestError} - Sin turno activo cuando se requiere para pagos en efectivo
   *
   * @efectos_secundarios
   * - Crea registros de Payment en la base de datos
   * - Actualiza Order.paymentStatus
   * - Opcionalmente actualiza Order.status a CONFIRMED y establece closedAt
   * - Opcionalmente libera la mesa asociada
   * - Crea entradas en AuditLog para PAYMENT_RECEIVED
   * - Transmite actualizacion de orden via KDS WebSocket
   *
   * PASO 1: ANALISIS DE COMPLEJIDAD
   * --------------------------------
   * Tiempo: O(n + m) donde n = pagos nuevos, m = pagos existentes
   * Espacio: O(n) para registros de pago a crear
   *
   * @example
   * const result = await orderService.addPayments(
   *   123,
   *   { payments: [{ method: 'CASH', amount: 50 }, { method: 'CARD', amount: 30 }], closeOrder: true },
   *   1, // tenantId
   *   5, // userId
   *   10 // shiftId
   * );
   */
  async addPayments(
    orderId: number,
    request: AddPaymentsRequest,
    tenantId: number,
    userId: number,
    shiftId?: number,
    auditContext?: { ipAddress?: string; userAgent?: string }
  ): Promise<AddPaymentsResult> {
    // =================================================================
    // PASO 3: IMPLEMENTACION
    // =================================================================

    // ---- Validacion de entrada (Programacion Defensiva) ----
    if (!orderId || orderId <= 0 || !Number.isInteger(orderId)) {
      throw new ValidationError('Order ID must be a positive integer');
    }
    if (!tenantId || tenantId <= 0) {
      throw new ValidationError('Tenant ID must be a positive integer');
    }
    if (!request.payments || !Array.isArray(request.payments) || request.payments.length === 0) {
      throw new ValidationError('At least one payment is required');
    }

    // Validar cada pago individualmente - O(n)
    for (const payment of request.payments) {
      if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount)) {
        throw new ValidationError(`Invalid payment amount: ${payment.amount}`);
      }
      if (payment.amount <= 0) {
        throw new ValidationError(`Payment amount must be positive: ${payment.amount}`);
      }
      if (!payment.method || typeof payment.method !== 'string' || payment.method.trim().length === 0) {
        throw new ValidationError('Payment method is required');
      }
    }

    // Calcular monto total a agregar - O(n)
    const amountToAdd = request.payments.reduce((sum, p) => sum + p.amount, 0);

    // ---- Ejecutar dentro de transaccion para cumplir con ACID ----
    const result = await prisma.$transaction(async (tx) => {
      // 1. Adquirir lock exclusivo de fila para prevenir condicion de carrera en pagos concurrentes.
      // Dos llamadas concurrentes a addPayments podrian leer el mismo valor de previouslyPaid,
      // causando sobrepago. SELECT FOR UPDATE serializa el acceso a esta fila.
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} AND tenantId = ${tenantId} FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          payments: true,
          table: true
        }
      });

      // ---- Caso borde: Orden no encontrada o no pertenece al tenant ----
      if (!order) {
        throw new NotFoundError('Order');
      }

      // ---- Caso borde: Orden ya cancelada ----
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictError('Cannot add payments to a cancelled order');
      }

      // ---- Caso borde: Orden ya completamente pagada ----
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictError('Order is already fully paid');
      }

      // 2. Calcular pagos existentes - O(m)
      const previouslyPaid = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const orderTotal = Number(order.total);
      const projectedTotal = previouslyPaid + amountToAdd;

      // ---- Caso borde: Sobrepago excesivo (tolerancia del 10% para redondeos) ----
      const maxAllowed = orderTotal * 1.10; // 10% de tolerancia para redondeos
      if (projectedTotal > maxAllowed && orderTotal > 0) {
        throw new ValidationError(
          `Payment total (${projectedTotal.toFixed(2)}) exceeds order total (${orderTotal.toFixed(2)}) by more than 10%`
        );
      }

      // 3. Resolver ID de turno si no se proporciono
      let resolvedShiftId = shiftId;
      if (!resolvedShiftId) {
        // Intentar encontrar turno activo para el usuario
        const activeShift = await tx.cashShift.findFirst({
          where: { userId, tenantId, endTime: null }
        });
        if (activeShift) {
          resolvedShiftId = activeShift.id;
        } else {
          // Verificar si algun pago requiere turno (CASH tipicamente lo requiere)
          const requiresShift = request.payments.some(p => {
            const method = mapToPaymentMethod(p.method);
            return method === PaymentMethod.CASH;
          });
          if (requiresShift) {
            logger.warn('Payment added without active shift', { orderId, userId });
            // No lanzar error — permitir pagos huerfanos para flexibilidad.
            // Regla de negocio: algunos establecimientos no usan turnos de caja.
          }
        }
      }

      // 4. Crear registros de pago - O(n)
      const paymentIds: number[] = [];
      for (const payment of request.payments) {
        const createdPayment = await tx.payment.create({
          data: {
            tenantId,
            orderId,
            amount: payment.amount,
            method: mapToPaymentMethod(payment.method),
            shiftId: resolvedShiftId ?? null
          }
        });
        paymentIds.push(createdPayment.id);

        // Registrar auditoria de cada pago (no bloqueante para no demorar la transaccion)
        auditService.logPayment('PAYMENT_RECEIVED', createdPayment.id, {
          tenantId,
          userId,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent
        }, {
          orderId,
          amount: payment.amount,
          method: payment.method,
          orderTotal,
          previouslyPaid,
          newTotalPaid: projectedTotal
        }).catch(err => logger.error('Audit log failed', { err }));
      }

      // 5. Calcular nuevo estado de pago
      const totalPaid = projectedTotal;
      const remainingBalance = orderTotal - totalPaid;
      let newPaymentStatus: PaymentStatus;

      if (totalPaid >= orderTotal) {
        newPaymentStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        newPaymentStatus = PaymentStatus.PARTIAL;
      } else {
        newPaymentStatus = PaymentStatus.PENDING;
      }

      // 6. Determinar si la orden debe cerrarse
      const shouldCloseOrder = request.closeOrder === true && newPaymentStatus === PaymentStatus.PAID;

      // 7. Actualizar la orden con el nuevo estado de pago
      const updateData: Prisma.OrderUpdateInput = {
        paymentStatus: newPaymentStatus
      };

      if (shouldCloseOrder) {
        updateData.status = OrderStatus.CONFIRMED;
        updateData.closedAt = new Date();
      }

      // SEGURO: tx.order.findFirst en L415 verifica propiedad del tenant
      await tx.order.update({
        where: { id: orderId },
        data: updateData
      });

      // 8. Liberar mesa si la orden se cerro y tiene mesa asociada
      if (shouldCloseOrder && order.tableId) {
        await tx.table.updateMany({
          where: { id: order.tableId, tenantId },
          data: {
            status: 'FREE',
            currentOrderId: null
          }
        });
        logger.info('Table freed after payment', { tableId: order.tableId, orderId });
      }

      return {
        orderId,
        orderTotal,
        previouslyPaid,
        amountAdded: amountToAdd,
        totalPaid,
        remainingBalance,
        paymentStatus: newPaymentStatus,
        orderClosed: shouldCloseOrder,
        paymentIds
      };
    }, {
      // Usar READ COMMITTED para prevenir lecturas sucias permitiendo lecturas concurrentes.
      // Para consistencia mas fuerte, usar SERIALIZABLE pero a costa de rendimiento.
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // Timeout de 10 segundos para prevenir transacciones de larga duracion
      timeout: 10000
    });

    // 9. Transmitir actualizacion al KDS (fuera de la transaccion para no bloquear)
    const fullOrder = await this.getById(orderId, tenantId);
    if (fullOrder) {
      kdsService.broadcastOrderUpdate(fullOrder);
    }

    logger.info('Payments added to order', {
      orderId,
      paymentCount: request.payments.length,
      amountAdded: result.amountAdded,
      newStatus: result.paymentStatus,
      closed: result.orderClosed
    });

    return result;
  }

  /**
   * Obtiene la orden activa (no pagada) de una mesa especifica.
   * Busca ordenes con estado de pago PENDING o PARTIAL, ordenadas por la mas reciente.
   */
  async getOrderByTable(tableId: number, tenantId: number) {
    return await prisma.order.findFirst({
      where: {
        tableId,
        tenantId,
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

  /**
   * Agrega items adicionales a una orden existente.
   *
   * Flujo:
   * 1. Verificar que la orden existe y no esta pagada
   * 2. Validar y calcular nuevos items
   * 3. Crear los items con sus modificadores
   * 4. Recalcular totales de la orden
   * 5. Reabrir la orden si estaba en estado DELIVERED/PREPARED para visibilidad en KDS
   * 6. Descontar stock si el modulo esta habilitado
   * 7. Notificar al KDS de los nuevos items
   */
  async addItemsToOrder(orderId: number, newItems: OrderItemInput[], serverId: number, tenantId: number) {
    // Verificar si la validacion de stock esta habilitada ANTES de la transaccion
    const stockEnabled = await isFeatureEnabled('enableStock', tenantId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener la orden existente y verificar que pertenezca al tenant
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true }
      });

      if (!order) throw new NotFoundError('Order');
      if (order.paymentStatus === 'PAID') throw new ValidationError('Cannot modify paid order');

      // 2. Validar y calcular nuevos items usando el servicio especializado
      const { itemDataList, stockUpdates, subtotal: additionalTotal } =
        await orderItemService.validateAndCalculateItems(tx, newItems, tenantId, stockEnabled);

      // 3. Crear los nuevos items de la orden con sus modificadores
      for (const itemData of itemDataList) {
        await tx.orderItem.create({
          data: {
            tenantId,
            orderId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            notes: itemData.notes ?? null,
            status: 'PENDING',
            ...(itemData.modifiers ? {
                modifiers: {
                    create: itemData.modifiers.map((m: { id: number; price: number }) => ({
                        tenantId,
                        modifierOptionId: m.id,
                        priceCharged: m.price
                    }))
                }
            } : {})
          }
        });
      }

      // 4. Actualizar totales de la orden y REABRIR si es necesario (para visibilidad en KDS)
      const newSubtotal = Number(order.subtotal) + additionalTotal;
      const newTotal = Number(order.total) + additionalTotal;

      // Si la orden estaba DELIVERED o PREPARED, reabrir a OPEN para que los nuevos items aparezcan en KDS
      const shouldReopen = ['DELIVERED', 'PREPARED'].includes(order.status);

      // SEGURO: tx.order.findFirst en L612 verifica propiedad del tenant
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          ...(shouldReopen ? { status: 'OPEN' as OrderStatus } : {})
        },
        include: { items: { include: { product: true } } }
      });

      // 5. Descontar stock si el modulo esta habilitado
      await executeIfEnabled('enableStock', async () => {
        const stockService = new StockMovementService();
        for (const update of stockUpdates) {
          await stockService.register(
            update.ingredientId,
            tenantId,
            StockMoveType.SALE,
            update.quantity,
            `Order #${order.orderNumber}`,
            tx
          );
        }
      }, tenantId);

      return updatedOrder;
    });

    // 6. Notificar al KDS de los nuevos items (fuera de la transaccion)
    const fullOrder = await this.getById(orderId, tenantId);
    if (fullOrder) {
        kdsService.broadcastOrderUpdate(fullOrder);
    }

    return result;
  }

  /**
   * Obtiene las 50 ordenes mas recientes del tenant.
   * Usado para la vista de historial rapido en el POS.
   */
  async getRecentOrders(tenantId: number) {
      return await prisma.order.findMany({
          where: { tenantId },
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } }
      });
  }

  /**
   * Obtiene ordenes activas para el KDS (Kitchen Display System).
   * @delegates orderKitchenService.getActiveOrders
   */
  async getActiveOrders(tenantId: number) {
    return orderKitchenService.getActiveOrders(tenantId);
  }

  /**
   * Actualiza el estado de la orden con validacion de maquina de estados.
   * @delegates orderStatusService.updateStatus
   */
  async updateStatus(orderId: number, status: OrderStatus, tenantId: number) {
    return orderStatusService.updateStatus(orderId, status, tenantId);
  }
}

export const orderService = new OrderService();
