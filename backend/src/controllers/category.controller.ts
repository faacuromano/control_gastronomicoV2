/**
 * @fileoverview Controlador de Categorías de Productos
 *
 * CRUD para las categorías del menú (ej: Bebidas, Entradas, Platos principales).
 * Las categorías agrupan productos y pueden tener una impresora asignada
 * para el ruteo automático de comandas a cocina/barra.
 *
 * Todas las operaciones están aisladas por tenant (multi-tenant).
 *
 * @module controllers/category.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

const CreateCategorySchema = z.object({
    name: z.string().min(1).max(100),
    printerId: z.number().int().positive().optional(),
}).strict().transform(({ printerId, ...rest }) => ({
    ...rest,
    ...(printerId !== undefined ? { printerId } : {}),
}));

const UpdateCategorySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    printerId: z.number().int().positive().nullable().optional(),
    kdsStationId: z.number().int().positive().nullable().optional(),
}).strict().transform((obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
);

/** Lista todas las categorías del tenant autenticado */
export const listCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await categoryService.getCategories(req.user!.tenantId!);
    sendSuccess(res, categories);
});

/** Obtiene una categoría por su ID, verificando pertenencia al tenant */
export const getCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const category = await categoryService.getCategoryById(id, req.user!.tenantId!);
    sendSuccess(res, category);
});

/** Crea una nueva categoría asociada al tenant del usuario autenticado */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
    const data = CreateCategorySchema.parse(req.body);
    const category = await categoryService.createCategory({
        ...data,
        tenantId: req.user!.tenantId!
    });
    sendSuccess(res, category, undefined, 201);
});

/** Actualiza una categoría existente verificando pertenencia al tenant */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const data = UpdateCategorySchema.parse(req.body);
    const category = await categoryService.updateCategory(id, req.user!.tenantId!, data);
    sendSuccess(res, category);
});

/** Elimina una categoría y sus productos asociados (verificando tenant) */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await categoryService.deleteCategory(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Categoría eliminada' });
});
