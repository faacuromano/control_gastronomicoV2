import { Request, Response } from 'express';
import { z } from 'zod';
import { IngredientService } from '../services/ingredient.service';
import { asyncHandler } from '../middleware/asyncHandler';

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
  const ingredients = await ingredientService.getAll();
  res.json({ success: true, data: ingredients });
});

export const getIngredientById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const ingredient = await ingredientService.getById(id);
  if (!ingredient) {
    return res.status(404).json({ success: false, error: 'Ingredient not found' });
  }
  res.json({ success: true, data: ingredient });
});

export const createIngredient = asyncHandler(async (req: Request, res: Response) => {
  const data = ingredientSchema.parse(req.body);
  const ingredient = await ingredientService.create({
      ...data,
      minStock: data.minStock ?? 0 
  });
  res.status(201).json({ success: true, data: ingredient });
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

  const ingredient = await ingredientService.update(id, cleanData);
  res.json({ success: true, data: ingredient });
});

export const deleteIngredient = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  await ingredientService.delete(id);
  res.json({ success: true, message: 'Ingredient deleted' });
});
