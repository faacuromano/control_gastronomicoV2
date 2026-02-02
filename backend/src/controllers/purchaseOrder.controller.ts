/**
 * @fileoverview Controlador de Órdenes de Compra a Proveedores
 *
 * Gestiona el ciclo de vida de las órdenes de compra de ingredientes:
 * creación, actualización de estado, recepción (que actualiza el stock)
 * y cancelación. Cada orden de compra se vincula a un proveedor y contiene
 * ítems con ingredientes, cantidades y costos unitarios.
 *
 * Flujo: PENDING -> ORDERED -> PARTIAL/RECEIVED (actualiza stock) | CANCELLED
 *
 * @module controllers/purchaseOrder.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { purchaseOrderService } from '../services/purchaseOrder.service';
import { sendSuccess } from '../utils/response';

/** Esquema de validación para crear una orden de compra con al menos un ítem */
const createOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(z.object({
    ingredientId: z.number().int().positive(),
    quantity: z.number().positive(),
    unitCost: z.number().positive()
  })).min(1, 'Order must have at least one item')
});

/** Esquema para actualizar el estado de una orden de compra */
const updateStatusSchema = z.object({
  status: z.nativeEnum(PurchaseStatus)
});

/** Obtiene todas las órdenes de compra, opcionalmente filtradas por estado */
export const getPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as PurchaseStatus | undefined;
  const orders = await purchaseOrderService.getAll(req.user!.tenantId!, status);
  sendSuccess(res, orders);
});

/** Obtiene una orden de compra por ID con sus ítems y proveedor */
export const getPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.getById(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/** Crea una nueva orden de compra a un proveedor */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = createOrderSchema.parse(req.body);
  const order = await purchaseOrderService.create(req.user!.tenantId!, {
    supplierId: data.supplierId,
    items: data.items,
    ...(data.notes !== undefined && { notes: data.notes }),
  });
  sendSuccess(res, order, undefined, 201);
});

/** Actualiza el estado de una orden de compra (ej: PENDING -> ORDERED) */
export const updatePurchaseOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { status } = updateStatusSchema.parse(req.body);
  const order = await purchaseOrderService.updateStatus(id, req.user!.tenantId!, status);
  sendSuccess(res, order);
});

/**
 * Marca una orden de compra como recibida.
 * Actualiza automáticamente el stock de ingredientes según las cantidades del pedido.
 */
export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.receivePurchaseOrder(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/** Cancela una orden de compra (solo si no ha sido recibida) */
export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.cancel(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/** Elimina una orden de compra del sistema */
export const deletePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await purchaseOrderService.delete(id, req.user!.tenantId!);
  sendSuccess(res, { message: 'Orden eliminada correctamente' });
});
