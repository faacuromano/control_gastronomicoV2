import { Request, Response } from 'express';
import { z } from 'zod';
import { modifierService } from '../services/modifier.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  minSelection: z.number().int().min(0).optional(),
  maxSelection: z.number().int().min(1).optional()
});

const updateGroupSchema = createGroupSchema.partial();

const createOptionSchema = z.object({
  name: z.string().min(1).max(100),
  priceOverlay: z.number().min(0).optional(),
  ingredientId: z.number().int().positive().optional(),
  qtyUsed: z.number().min(0).optional()
});

const updateOptionSchema = createOptionSchema.partial();

export const getGroups = asyncHandler(async (req: Request, res: Response) => {
  const { page: pageStr, limit: limitStr } = req.query;

  // Parse pagination params
  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.max(1, parseInt(limitStr as string) || 50);

  const result = await modifierService.getAllGroups(req.user!.tenantId!, page, limit);

  sendSuccess(res, result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit)
  });
});

export const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await modifierService.getGroupById(Number(req.params.id), req.user!.tenantId!);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
  sendSuccess(res, group);
});

export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const data = createGroupSchema.parse(req.body);
  const group = await modifierService.createGroup({
    ...data,
    tenantId: req.user!.tenantId!
  } as any);
  sendSuccess(res, group, undefined, 201);
});

export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
  const data = updateGroupSchema.parse(req.body);
  const group = await modifierService.updateGroup(Number(req.params.id), req.user!.tenantId!, data as any);
  sendSuccess(res, group);
});

export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteGroup(Number(req.params.id), req.user!.tenantId!);
  sendSuccess(res, null);
});

export const addOption = asyncHandler(async (req: Request, res: Response) => {
  const data = createOptionSchema.parse(req.body);
  const option = await modifierService.addOption(Number(req.params.groupId), req.user!.tenantId!, data as any);
  sendSuccess(res, option, undefined, 201);
});

export const updateOption = asyncHandler(async (req: Request, res: Response) => {
  const data = updateOptionSchema.parse(req.body);
  const option = await modifierService.updateOption(Number(req.params.optionId), req.user!.tenantId!, data as any);
  sendSuccess(res, option);
});

export const deleteOption = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteOption(Number(req.params.optionId), req.user!.tenantId!);
  sendSuccess(res, null);
});
