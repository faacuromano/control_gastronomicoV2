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
import * as categoryService from '../services/category.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

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
    const category = await categoryService.createCategory({
        ...req.body,
        tenantId: req.user!.tenantId!
    });
    sendSuccess(res, category, undefined, 201);
});

/** Actualiza una categoría existente verificando pertenencia al tenant */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const category = await categoryService.updateCategory(id, req.user!.tenantId!, req.body);
    sendSuccess(res, category);
});

/** Elimina una categoría y sus productos asociados (verificando tenant) */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await categoryService.deleteCategory(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Categoría eliminada' });
});
