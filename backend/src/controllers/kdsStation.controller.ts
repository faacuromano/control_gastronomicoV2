/**
 * @fileoverview Controlador de Estaciones KDS
 *
 * Gestiona las estaciones del Kitchen Display System para enrutar items
 * a diferentes pantallas de preparación (cocina, barra, fría, postres, etc.)
 *
 * Endpoints:
 * - GET /api/v1/kds-stations - Listar estaciones
 * - GET /api/v1/kds-stations/:id - Obtener estación
 * - POST /api/v1/kds-stations - Crear estación
 * - PATCH /api/v1/kds-stations/:id - Actualizar estación
 * - DELETE /api/v1/kds-stations/:id - Eliminar estación
 * - POST /api/v1/kds-stations/:id/set-default - Establecer como default
 * - POST /api/v1/kds-stations/seed - Crear estaciones por defecto
 *
 * @module controllers/kdsStation.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { kdsStationService } from '../services/kdsStation.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';

const CreateKdsStationSchema = z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
}).strict().transform((obj) => {
    const result: { name: string; code: string; sortOrder?: number; isActive?: boolean; isDefault?: boolean } = {
        name: obj.name,
        code: obj.code,
    };
    if (obj.sortOrder !== undefined) result.sortOrder = obj.sortOrder;
    if (obj.isActive !== undefined) result.isActive = obj.isActive;
    if (obj.isDefault !== undefined) result.isDefault = obj.isDefault;
    return result;
});

const UpdateKdsStationSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores').optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
}).strict().transform((obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
);

/**
 * Lista todas las estaciones KDS del tenant.
 * GET /api/v1/kds-stations
 */
export const getStations = asyncHandler(async (req: Request, res: Response) => {
    const stations = await kdsStationService.getStations(req.user!.tenantId!);
    sendSuccess(res, stations);
});

/**
 * Obtiene una estación por ID.
 * GET /api/v1/kds-stations/:id
 */
export const getStation = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
        throw new ValidationError('Invalid station ID');
    }

    const station = await kdsStationService.getStation(id, req.user!.tenantId!);
    sendSuccess(res, station);
});

/**
 * Crea una nueva estación KDS.
 * POST /api/v1/kds-stations
 * Body: { name: string, code: string, sortOrder?: number, isActive?: boolean, isDefault?: boolean }
 */
export const createStation = asyncHandler(async (req: Request, res: Response) => {
    const data = CreateKdsStationSchema.parse(req.body);

    const station = await kdsStationService.createStation(req.user!.tenantId!, data);

    sendSuccess(res, station, undefined, 201);
});

/**
 * Actualiza una estación existente.
 * PATCH /api/v1/kds-stations/:id
 * Body: { name?: string, code?: string, sortOrder?: number, isActive?: boolean, isDefault?: boolean }
 */
export const updateStation = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
        throw new ValidationError('Invalid station ID');
    }

    const data = UpdateKdsStationSchema.parse(req.body);

    const station = await kdsStationService.updateStation(id, req.user!.tenantId!, data);

    sendSuccess(res, station);
});

/**
 * Elimina una estación KDS.
 * DELETE /api/v1/kds-stations/:id
 * Solo si no tiene productos o categorías asignados.
 */
export const deleteStation = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
        throw new ValidationError('Invalid station ID');
    }

    await kdsStationService.deleteStation(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Estación eliminada' });
});

/**
 * Establece una estación como default.
 * POST /api/v1/kds-stations/:id/set-default
 */
export const setDefaultStation = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
        throw new ValidationError('Invalid station ID');
    }

    const station = await kdsStationService.setDefaultStation(id, req.user!.tenantId!);
    sendSuccess(res, station);
});

/**
 * Crea las estaciones por defecto para el tenant.
 * POST /api/v1/kds-stations/seed
 * Útil para tenants existentes que no tienen estaciones.
 */
export const seedDefaultStations = asyncHandler(async (req: Request, res: Response) => {
    const stations = await kdsStationService.seedDefaultStations(req.user!.tenantId!);
    sendSuccess(res, stations, undefined, 201);
});
