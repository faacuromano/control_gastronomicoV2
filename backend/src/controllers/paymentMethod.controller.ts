import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { paymentMethodService } from '../services/paymentMethod.service';

const createSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(50),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

const updateSchema = createSchema.partial();

/**
 * Get all payment methods (admin)
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const methods = await paymentMethodService.getAll(req.user!.tenantId!);
  res.json({ success: true, data: methods });
});

/**
 * Get active payment methods (for POS)
 */
export const getActive = asyncHandler(async (req: Request, res: Response) => {
  const methods = await paymentMethodService.getActive(req.user!.tenantId!);
  res.json({ success: true, data: methods });
});

/**
 * Get by ID
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const method = await paymentMethodService.getById(id, req.user!.tenantId!);
  res.json({ success: true, data: method });
});

/**
 * Create new payment method
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const method = await paymentMethodService.create(req.user!.tenantId!, data as any);
  res.status(201).json({ success: true, data: method });
});

/**
 * Update payment method
 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const data = updateSchema.parse(req.body);
  const method = await paymentMethodService.update(id, req.user!.tenantId!, data as any);
  res.json({ success: true, data: method });
});

/**
 * Toggle active status
 */
export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const method = await paymentMethodService.toggleActive(id, req.user!.tenantId!);
  res.json({ success: true, data: method });
});

/**
 * Delete payment method
 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await paymentMethodService.delete(id, req.user!.tenantId!);
  res.json({ success: true, message: 'Payment method deleted' });
});

/**
 * Seed default payment methods
 */
export const seedDefaults = asyncHandler(async (req: Request, res: Response) => {
  await paymentMethodService.seedDefaults(req.user!.tenantId!);
  res.json({ success: true, message: 'Default payment methods seeded' });
});
