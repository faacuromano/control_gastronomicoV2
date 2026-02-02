/**
 * @fileoverview Controlador de Ingredientes (Inventario)
 *
 * CRUD para los ingredientes que componen los productos del menú.
 * Cada ingrediente tiene un costo, stock actual, unidad de medida y
 * stock mínimo para alertas. Forma la base del sistema de inventario.
 *
 * @module controllers/ingredient.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { IngredientService } from '../services/ingredient.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

const ingredientService = new IngredientService();

/** Esquema de validación para crear un ingrediente con todos sus campos requeridos */
const ingredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  cost: z.number().min(0),
  stock: z.number().min(0),
  minStock: z.number().min(0).optional()
});

/** Esquema parcial para actualización: todos los campos son opcionales */
const updateIngredientSchema = ingredientSchema.partial();

/**
 * Lista todos los ingredientes del tenant con paginación.
 * Por defecto devuelve hasta 100 ingredientes por página.
 */
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

/** Obtiene un ingrediente por ID verificando pertenencia al tenant */
export const getIngredientById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const ingredient = await ingredientService.getById(id, req.user!.tenantId!);
  if (!ingredient) {
    return res.status(404).json({ success: false, error: 'Ingredient not found' });
  }
  return sendSuccess(res, ingredient);
});

/** Crea un nuevo ingrediente en el inventario del tenant. El minStock por defecto es 0. */
export const createIngredient = asyncHandler(async (req: Request, res: Response) => {
  const data = ingredientSchema.parse(req.body);
  const ingredient = await ingredientService.create(req.user!.tenantId!, {
      ...data,
      minStock: data.minStock ?? 0
  });
  sendSuccess(res, ingredient, undefined, 201);
});

/**
 * Actualiza un ingrediente existente. Solo se actualizan los campos proporcionados,
 * los demás mantienen su valor actual (actualización parcial).
 */
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
  return sendSuccess(res, ingredient);
});

/** Elimina un ingrediente del inventario del tenant */
export const deleteIngredient = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt((req.params.id as string) || '0');
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  await ingredientService.delete(id, req.user!.tenantId!);
  return sendSuccess(res, { message: 'Ingredient deleted' });
});
