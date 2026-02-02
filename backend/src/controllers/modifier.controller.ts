/**
 * @fileoverview Controlador de Modificadores de Productos
 *
 * Gestiona los grupos de modificadores y sus opciones. Los modificadores permiten
 * personalizar productos (ej: grupo "Cocción" con opciones "Jugoso", "A punto", "Bien cocido";
 * grupo "Extras" con opciones "Queso", "Bacon", etc.). Cada opción puede tener un
 * precio adicional (priceOverlay) y opcionalmente descontar un ingrediente del inventario.
 *
 * Estructura: ModifierGroup -> ModifierOption (1:N)
 * Vinculación: Product -> ProductModifierGroup -> ModifierGroup (N:M)
 *
 * @module controllers/modifier.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { modifierService } from '../services/modifier.service';
import type { UpdateGroupInput, CreateOptionInput, UpdateOptionInput } from '../services/modifier.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

/** Esquema para crear un grupo de modificadores con límites de selección */
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  minSelection: z.number().int().min(0).optional(),
  maxSelection: z.number().int().min(1).optional()
});

const updateGroupSchema = createGroupSchema.partial();

/** Esquema para crear una opción dentro de un grupo (ej: "Queso extra" con precio $200) */
const createOptionSchema = z.object({
  name: z.string().min(1).max(100),
  priceOverlay: z.number().min(0).optional(),
  ingredientId: z.number().int().positive().optional(),
  qtyUsed: z.number().min(0).optional()
});

const updateOptionSchema = createOptionSchema.partial();

/** Lista todos los grupos de modificadores del tenant con paginación */
export const getGroups = asyncHandler(async (req: Request, res: Response) => {
  const { page: pageStr, limit: limitStr } = req.query;

  // Parsear parámetros de paginación con valores por defecto
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

/** Obtiene un grupo de modificadores por ID con sus opciones */
export const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await modifierService.getGroupById(Number(req.params.id), req.user!.tenantId!);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
  return sendSuccess(res, group);
});

/** Crea un nuevo grupo de modificadores para el tenant */
export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const data = createGroupSchema.parse(req.body);
  const group = await modifierService.createGroup({
    name: data.name,
    minSelection: data.minSelection,
    maxSelection: data.maxSelection,
    tenantId: req.user!.tenantId!
  });
  sendSuccess(res, group, undefined, 201);
});

/** Actualiza un grupo de modificadores existente */
export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
  const data = updateGroupSchema.parse(req.body);
  const group = await modifierService.updateGroup(Number(req.params.id), req.user!.tenantId!, data as UpdateGroupInput);
  sendSuccess(res, group);
});

/** Elimina un grupo de modificadores y todas sus opciones */
export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteGroup(Number(req.params.id), req.user!.tenantId!);
  sendSuccess(res, null);
});

/** Agrega una opción a un grupo de modificadores existente */
export const addOption = asyncHandler(async (req: Request, res: Response) => {
  const data = createOptionSchema.parse(req.body);
  const option = await modifierService.addOption(Number(req.params.groupId), req.user!.tenantId!, data as CreateOptionInput);
  sendSuccess(res, option, undefined, 201);
});

/** Actualiza una opción de modificador existente */
export const updateOption = asyncHandler(async (req: Request, res: Response) => {
  const data = updateOptionSchema.parse(req.body);
  const option = await modifierService.updateOption(Number(req.params.optionId), req.user!.tenantId!, data as UpdateOptionInput);
  sendSuccess(res, option);
});

/** Elimina una opción de modificador */
export const deleteOption = asyncHandler(async (req: Request, res: Response) => {
  await modifierService.deleteOption(Number(req.params.optionId), req.user!.tenantId!);
  sendSuccess(res, null);
});
