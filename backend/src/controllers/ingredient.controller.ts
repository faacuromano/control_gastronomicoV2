import { Request, Response } from 'express';
import { z } from 'zod';
import { IngredientService } from '../services/ingredient.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

const ingredientService = new IngredientService();

const ingredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  cost: z.number().min(0),
  stock: z.number().min(0),
  minStock: z.number().min(0).optional()
});

const updateIngredientSchema = ingredientSchema.partial();

export const getIngredients = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, parseInt(req.query.limit as string) || 100);
  const result = await ingredientService.getAll(req.user!.tenantId!, page, limit);
  sendSuccess(res, result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit)
  });
});

export const getIngredientById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const ingredient = await ingredientService.getById(id, req.user!.tenantId!);
  if (!ingredient) {
    return res.status(404).json({ success: false, error: 'Ingredient not found' });
  }
  sendSuccess(res, ingredient);
});

export const createIngredient = asyncHandler(async (req: Request, res: Response) => {
  const data = ingredientSchema.parse(req.body);
  const ingredient = await ingredientService.create(req.user!.tenantId!, {
      ...data,
      minStock: data.minStock ?? 0
  });
  sendSuccess(res, ingredient, undefined, 201);
});

export const updateIngredient = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const data = updateIngredientSchema.parse(req.body);
  const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  const ingredient = await ingredientService.update(id, req.user!.tenantId!, cleanData);
  sendSuccess(res, ingredient);
});

export const deleteIngredient = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  await ingredientService.delete(id, req.user!.tenantId!);
  sendSuccess(res, { message: 'Ingredient deleted' });
});
