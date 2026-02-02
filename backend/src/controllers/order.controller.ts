/**
 * @fileoverview Controlador de Órdenes
 *
 * Maneja todas las operaciones HTTP relacionadas con órdenes: creación,
 * consulta, cambios de estado, pagos, anulación de ítems y transferencia
 * entre mesas. Es el controlador más complejo del sistema ya que una orden
 * involucra múltiples entidades (items, modificadores, pagos, mesa, cliente).
 *
 * Flujo principal de una orden:
 * 1. Creación (createOrder) -> estado OPEN
 * 2. Confirmación -> estado CONFIRMED
 * 3. Preparación (KDS) -> estado IN_PREPARATION
 * 4. Preparado -> estado PREPARED
 * 5. Servido -> items en estado SERVED
 * 6. Pago (addPayments) -> estado PAID cuando se cubre el total
 *
 * @module controllers/order.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderService, CreateOrderInput, OrderItemInput } from '../services/order.service';
import { OrderChannel, PaymentMethod, OrderStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { sendSuccess } from '../utils/response';

const orderService = new OrderService();

/**
 * Esquema Zod para validar la creación de una orden.
 * SEC-023: Límites de longitud en campos de texto para prevenir abuso.
 */
const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
    modifiers: z.array(z.object({
      id: z.number().int().positive(),
      price: z.coerce.number()  // Acepta strings de Prisma Decimal y los convierte a number
    })).optional(),
    removedIngredientIds: z.array(z.number().int().positive()).optional()
  })).min(1, "Order must have at least one item"),
  channel: z.nativeEnum(OrderChannel).optional(),
  tableId: z.number().int().optional(),
  clientId: z.number().int().optional(),
  paymentMethod: z.union([z.nativeEnum(PaymentMethod), z.literal('SPLIT')]).optional(),
  payments: z.array(z.object({
      method: z.string().min(1).max(50),
      amount: z.number().positive()
  })).optional(),
  deliveryData: z.object({
    address: z.string().max(500),
    notes: z.string().max(500).optional(),
    phone: z.string().max(30).optional(),
    name: z.string().max(200).optional(),
    driverId: z.number().int().optional(),
  }).optional(),
  discount: z.number().min(0).optional(),
});

/**
 * Esquema Zod para agregar ítems a una orden existente.
 * Reutiliza la misma estructura de items que la creación.
 */
const addItemsSchema = z.object({
    items: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        modifiers: z.array(z.object({
            id: z.number().int().positive(),
            price: z.coerce.number()  // Acepta strings de Prisma Decimal
        })).optional(),
        removedIngredientIds: z.array(z.number().int().positive()).optional()
    })).min(1, "Must add at least one item")
});

/** Esquema para actualizar el estado general de la orden */
const updateStatusSchema = z.object({
    status: z.nativeEnum(OrderStatus)
});

/** Esquema para actualizar el estado de un ítem individual (flujo KDS) */
const updateItemStatusSchema = z.object({
    status: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED'])
});

/**
 * Esquema para agregar pagos a una orden existente.
 * Soporta pagos divididos (split) con múltiples métodos.
 *
 * Validaciones defensivas:
 * - payments: Array de al menos 1 pago, máximo 10
 * - method: Código de método de pago dinámico (CASH, CARD, DEBIT, etc.)
 * - amount: Monto positivo mayor a 0.01
 * - closeOrder: Opcional, cierra la orden automáticamente si está completamente pagada
 */
const addPaymentsSchema = z.object({
    payments: z.array(z.object({
        method: z.string()
            .min(1, 'Payment method is required')
            .max(50, 'Payment method too long'),
        amount: z.number()
            .positive('Payment amount must be positive')
            .finite('Payment amount must be a finite number')
            .refine(val => val >= 0.01, 'Payment amount must be at least 0.01')
    })).min(1, 'At least one payment is required')
      .max(10, 'Maximum 10 payments per request'),
    closeOrder: z.boolean().optional().default(false)
});

/** Actualiza el estado general de una orden (ej: OPEN -> CONFIRMED -> IN_PREPARATION) */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateStatus(Number(req.params.id as string), status, req.user!.tenantId!);
    sendSuccess(res, order);
});

/** Actualiza el estado de un ítem individual (flujo de cocina: PENDING -> COOKING -> READY -> SERVED) */
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = updateItemStatusSchema.parse(req.body);
    const item = await orderService.updateItemStatus(Number(req.params.itemId as string), status, req.user!.tenantId!);
    sendSuccess(res, item);
});

/** Obtiene las órdenes activas (no cerradas/canceladas) para la pantalla de KDS (Kitchen Display System) */
export const getActiveOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getActiveOrders(req.user!.tenantId!);
    sendSuccess(res, orders);
});

/**
 * Crea una nueva orden completa con ítems, modificadores y opcionalmente pagos.
 * Requiere usuario autenticado (serverId) y contexto de tenant.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const data = createOrderSchema.parse(req.body);

    // Obtener serverId del usuario autenticado (tipado via express.d.ts)
    const serverId = req.user?.id;

    if (!serverId) {
        throw new UnauthorizedError('User ID required');
    }

    // P0-03 FIX: tenantId SIEMPRE debe estar presente — nunca condicional
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        throw new UnauthorizedError('Tenant context required');
    }

    // Construir input de orden con tipado correcto, mapeando items explícitamente
    const orderInput: CreateOrderInput = {
      tenantId,
      userId: serverId,
      serverId,
      items: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers,
          removedIngredientIds: item.removedIngredientIds
      })),
      channel: data.channel,
      tableId: data.tableId,
      clientId: data.clientId,
      paymentMethod: data.paymentMethod,
      payments: data.payments?.map(p => ({ method: p.method.toString(), amount: p.amount })),
      deliveryData: data.deliveryData ? {
          address: data.deliveryData.address,
          notes: data.deliveryData.notes,
          phone: data.deliveryData.phone ?? '',
          name: data.deliveryData.name ?? '',
          driverId: data.deliveryData.driverId
      } : undefined,
      discount: data.discount
    };

    const order = await orderService.createOrder(orderInput);
    sendSuccess(res, order, undefined, 201);
});

/** Obtiene las órdenes recientes del tenant para el listado del POS */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await orderService.getRecentOrders(req.user!.tenantId!);
    sendSuccess(res, orders);
});

/** Obtiene la orden activa asociada a una mesa específica */
export const getOrderByTable = asyncHandler(async (req: Request, res: Response) => {
    const tableId = Number(req.params.tableId as string);
    if (isNaN(tableId)) {
        return res.status(400).json({ success: false, error: 'Invalid table ID' });
    }
    const order = await orderService.getOrderByTable(tableId, req.user!.tenantId!);
    sendSuccess(res, order);
});

/** Agrega ítems adicionales a una orden existente (ej: cliente pide más platos) */
export const addItemsToOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId as string);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }
    const data = addItemsSchema.parse(req.body);
    const serverId = req.user?.id;

    if (!serverId) {
        throw new UnauthorizedError();
    }

    // Mapear ítems parseados por Zod al tipo OrderItemInput
    const items: OrderItemInput[] = data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers,
        removedIngredientIds: item.removedIngredientIds
    }));

    const order = await orderService.addItemsToOrder(orderId, items, serverId, req.user!.tenantId!);
    sendSuccess(res, order);
});

/**
 * Agrega uno o más pagos a una orden existente.
 *
 * POST /api/v1/orders/:id/payments
 *
 * Soporta pagos divididos y códigos de método de pago dinámicos.
 * Opcionalmente cierra la orden cuando está completamente pagada.
 *
 * Casos límite manejados:
 * 1. ID de orden inválido (NaN, negativo, no entero) -> 400
 * 2. Orden no encontrada -> 404
 * 3. Orden de otro tenant -> 404 (seguridad: sin fuga de información)
 * 4. Orden ya cancelada -> 409 Conflict
 * 5. Orden ya completamente pagada -> 409 Conflict
 * 6. Montos de pago cero o negativos -> 400
 * 7. Sobrepago excesivo (>10% del total) -> 400
 * 8. Array de pagos vacío -> 400
 * 9. Sin autenticación -> 401
 * 10. Pagos concurrentes -> manejado por aislamiento de transacción
 */
export const addPayments = asyncHandler(async (req: Request, res: Response) => {
    // 1. Parsear y validar ID de orden desde parámetros URL
    const orderId = Number(req.params.id);
    if (isNaN(orderId) || orderId <= 0 || !Number.isInteger(orderId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid order ID',
            code: 'INVALID_ORDER_ID'
        });
    }

    // 2. Validar cuerpo de la solicitud con esquema Zod
    const validationResult = addPaymentsSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validationResult.error.flatten()
        });
    }
    const data = validationResult.data;

    // 3. Extraer contexto del usuario autenticado
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId) {
        throw new UnauthorizedError('User ID required');
    }
    if (!tenantId) {
        throw new UnauthorizedError('Tenant ID required');
    }

    // 4. Construir contexto de auditoría (filtrar undefined para exactOptionalPropertyTypes)
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const auditContext: { ipAddress?: string; userAgent?: string } = {};
    if (ipAddress) auditContext.ipAddress = ipAddress;
    if (userAgent) auditContext.userAgent = userAgent;

    // 5. Delegar al servicio de órdenes
    const result = await orderService.addPayments(
        orderId,
        {
            payments: data.payments,
            closeOrder: data.closeOrder
        },
        tenantId,
        userId,
        undefined, // shiftId se resuelve en el servicio
        Object.keys(auditContext).length > 0 ? auditContext : undefined
    );

    // 6. Respuesta exitosa con datos completos del resultado
    sendSuccess(res, result);
});

/** Obtiene órdenes de delivery activas para la pantalla de gestión de delivery */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    logger.debug('getDeliveryOrders requested', { userId: req.user?.id });
    const orders = await orderService.getDeliveryOrders(req.user!.tenantId!);
    logger.debug('getDeliveryOrders result', { count: orders.length });
    sendSuccess(res, orders);
});

/** Asigna un repartidor a una orden de delivery */
export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.id as string);
    const { driverId } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' });
    if (!driverId) return res.status(400).json({ success: false, error: 'Driver ID required' });

    const order = await orderService.assignDriver(orderId, Number(driverId), req.user!.tenantId!);
    sendSuccess(res, order);
});

/**
 * Marca todos los ítems de una orden como SERVED.
 * Usado por cocina cuando la orden completa está lista para retirar por el mozo.
 */
export const markAllItemsServed = asyncHandler(async (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId as string);

    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const order = await orderService.markAllItemsServed(orderId, req.user!.tenantId!);
    sendSuccess(res, order);
});

// =============================================================================
// FASE 2: OPERACIONES DE ANULACION Y TRANSFERENCIA
// =============================================================================

import { orderVoidService, VoidReason, VOID_REASONS } from '../services/orderVoid.service';
import { orderTransferService } from '../services/orderTransfer.service';

/** Esquema de validación para anulación de ítems con motivo obligatorio */
const voidItemSchema = z.object({
    reason: z.enum(VOID_REASONS as unknown as [string, ...string[]]),
    notes: z.string().optional()
});

/**
 * Anula (cancela) un ítem de orden.
 * Requiere permiso orders:delete (acción de gerente/administrador).
 * Registra auditoría con el motivo de anulación y contexto del usuario.
 */
export const voidItem = asyncHandler(async (req: Request, res: Response) => {
    const itemId = Number(req.params.itemId as string);
    if (isNaN(itemId)) {
        return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }

    const data = voidItemSchema.parse(req.body);

    const tenantId = req.user!.tenantId!;
    const result = await orderVoidService.voidItem(
        {
            orderItemId: itemId,
            reason: data.reason as VoidReason,
            notes: data.notes
        },
        tenantId,
        {
            userId: req.user?.id,
            tenantId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );

    sendSuccess(res, result);
});

/** Obtiene los motivos de anulación disponibles para poblar el dropdown en la UI */
export const getVoidReasons = asyncHandler(async (_req: Request, res: Response) => {
    const reasons = orderVoidService.getVoidReasons();
    sendSuccess(res, reasons);
});

/** Esquema de validación para transferencia de ítems entre mesas */
const transferItemsSchema = z.object({
    itemIds: z.array(z.number().int().positive()).min(1),
    fromTableId: z.number().int().positive(),
    toTableId: z.number().int().positive()
});

/**
 * Transfiere ítems de una mesa a otra.
 * Útil cuando un cliente cambia de mesa o se fusionan/dividen cuentas.
 * Registra auditoría con las mesas de origen y destino.
 */
export const transferItems = asyncHandler(async (req: Request, res: Response) => {
    const data = transferItemsSchema.parse(req.body);

    const tenantId = req.user!.tenantId!;
    const result = await orderTransferService.transferItems(
        data.itemIds,
        data.fromTableId,
        data.toTableId,
        tenantId,
        {
            userId: req.user?.id,
            tenantId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );

    sendSuccess(res, result);
});
