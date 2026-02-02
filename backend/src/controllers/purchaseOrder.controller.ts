import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { purchaseOrderService } from '../services/purchaseOrder.service';
import { sendSuccess } from '../utils/response';

/**
 * Zod schema for creating purchase order
 */
const createOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(z.object({
    ingredientId: z.number().int().positive(),
    quantity: z.number().positive(),
    unitCost: z.number().positive()
  })).min(1, 'Order must have at least one item')
});

/**
 * Zod schema for status update
 */
const updateStatusSchema = z.object({
  status: z.nativeEnum(PurchaseStatus)
});

/**
 * Get all purchase orders
 */
export const getPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as PurchaseStatus | undefined;
  const orders = await purchaseOrderService.getAll(req.user!.tenantId!, status);
  sendSuccess(res, orders);
});

/**
 * Get purchase order by ID
 */
export const getPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.getById(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/**
 * Create new purchase order
 */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = createOrderSchema.parse(req.body);
  const order = await purchaseOrderService.create(req.user!.tenantId!, {
    supplierId: data.supplierId,
    items: data.items,
    ...(data.notes !== undefined && { notes: data.notes }),
  });
  sendSuccess(res, order, undefined, 201);
});

/**
 * Update purchase order status
 */
export const updatePurchaseOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { status } = updateStatusSchema.parse(req.body);
  const order = await purchaseOrderService.updateStatus(id, req.user!.tenantId!, status);
  sendSuccess(res, order);
});

/**
 * Receive purchase order (updates stock)
 */
export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.receivePurchaseOrder(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.cancel(id, req.user!.tenantId!);
  sendSuccess(res, order);
});

/**
 * Delete purchase order
 */
export const deletePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await purchaseOrderService.delete(id, req.user!.tenantId!);
  sendSuccess(res, { message: 'Orden eliminada correctamente' });
});
