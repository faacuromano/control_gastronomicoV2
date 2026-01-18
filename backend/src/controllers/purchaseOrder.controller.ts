import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseStatus, Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { purchaseOrderService } from '../services/purchaseOrder.service';

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
  })).min(1, 'La orden debe tener al menos un item')
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
  const orders = await purchaseOrderService.getAll(status);
  res.json({ success: true, data: orders });
});

/**
 * Get purchase order by ID
 */
export const getPurchaseOrderById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.getById(id);
  res.json({ success: true, data: order });
});

/**
 * Create new purchase order
 */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = createOrderSchema.parse(req.body);
  // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
  const order = await purchaseOrderService.create(data as any);
  res.status(201).json({ success: true, data: order });
});

/**
 * Update purchase order status
 */
export const updatePurchaseOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { status } = updateStatusSchema.parse(req.body);
  const order = await purchaseOrderService.updateStatus(id, status);
  res.json({ success: true, data: order });
});

/**
 * Receive purchase order (updates stock)
 */
export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.receivePurchaseOrder(id);
  res.json({ success: true, data: order, message: 'Orden recibida y stock actualizado' });
});

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const order = await purchaseOrderService.cancel(id);
  res.json({ success: true, data: order });
});

/**
 * Delete purchase order
 */
export const deletePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await purchaseOrderService.delete(id);
  res.json({ success: true, message: 'Orden eliminada correctamente' });
});
