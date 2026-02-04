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
import { kdsStationService } from '../services/kdsStation.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';

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
    const { name, code, sortOrder, isActive, isDefault } = req.body;

    const station = await kdsStationService.createStation(req.user!.tenantId!, {
        name,
        code,
        sortOrder,
        isActive,
        isDefault
    });

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

    const { name, code, sortOrder, isActive, isDefault } = req.body;

    const station = await kdsStationService.updateStation(id, req.user!.tenantId!, {
        name,
        code,
        sortOrder,
        isActive,
        isDefault
    });

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
