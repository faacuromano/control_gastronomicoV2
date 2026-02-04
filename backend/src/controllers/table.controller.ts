/**
 * @fileoverview Controlador de Mesas y Áreas del Restaurante
 *
 * Gestiona las áreas del salón (ej: Salón Principal, Terraza, VIP) y las mesas
 * dentro de cada área. Las mesas tienen posiciones X/Y para el mapa visual del salón
 * en el frontend, y estados (FREE, OCCUPIED, RESERVED, CLEANING).
 *
 * Operaciones de mesas:
 * - CRUD de áreas y mesas
 * - Apertura de mesa (crea una orden automáticamente)
 * - Cierre de mesa con pago
 * - Actualización de posiciones para el mapa drag-and-drop
 *
 * @module controllers/table.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { tableService } from '../services/table.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

/** FIX IP-001: Validar que el parámetro tableId sea un entero positivo */
const tableIdSchema = z.coerce.number().int().positive();

// ============================================================================
// AREAS
// ============================================================================

/** Lista todas las áreas del restaurante con sus mesas */
export const getAreas = asyncHandler(async (req: Request, res: Response) => {
    const areas = await tableService.getAreas(req.user!.tenantId!);
    sendSuccess(res, areas);
});

/** Crea una nueva área en el restaurante */
export const createArea = asyncHandler(async (req: Request, res: Response) => {
    const area = await tableService.createArea(req.user!.tenantId!, req.body);
    sendSuccess(res, area, undefined, 201);
});

/** Actualiza el nombre u otros datos de un área */
export const updateArea = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id as string);
    const area = await tableService.updateArea(id, req.user!.tenantId!, req.body);
    sendSuccess(res, area);
});

/** Elimina un área (solo si no tiene mesas ocupadas) */
export const deleteArea = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id as string);
    await tableService.deleteArea(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Área eliminada' });
});

// ============================================================================
// MESAS
// ============================================================================

/** Crea una nueva mesa dentro de un área */
export const createTable = asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.createTable(req.user!.tenantId!, req.body);
    sendSuccess(res, table, undefined, 201);
});

/** Actualiza los datos de una mesa (nombre, capacidad, área, etc.) */
export const updateTable = asyncHandler(async (req: Request, res: Response) => {
    const id = tableIdSchema.parse(req.params.id);
    const table = await tableService.updateTable(id, req.user!.tenantId!, req.body);
    sendSuccess(res, table);
});

/** Actualiza la posición X/Y de una mesa individual en el mapa visual */
export const updatePosition = asyncHandler(async (req: Request, res: Response) => {
    const id = tableIdSchema.parse(req.params.id);
    const { x, y } = req.body;
    const table = await tableService.updateTablePosition(id, req.user!.tenantId!, x, y);
    sendSuccess(res, table);
});

/** Actualiza las posiciones de múltiples mesas a la vez (usado por drag-and-drop masivo) */
export const updatePositions = asyncHandler(async (req: Request, res: Response) => {
    const { updates } = req.body; // Espera array de {id, x, y}
    if (!Array.isArray(updates)) {
        throw new ValidationError('Updates must be an array');
    }
    const result = await tableService.updatePositions(req.user!.tenantId!, updates);
    sendSuccess(res, result);
});

/** Elimina una mesa (solo si está libre) */
export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
    const id = tableIdSchema.parse(req.params.id);
    await tableService.deleteTable(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Mesa eliminada' });
});

/** Obtiene una mesa por ID con su orden activa si existe */
export const getTable = asyncHandler(async (req: Request, res: Response) => {
    const id = tableIdSchema.parse(req.params.id);
    const table = await tableService.getTable(id, req.user!.tenantId!);
    sendSuccess(res, table);
});

// ============================================================================
// OPERACIONES DE MESA
// ============================================================================

/**
 * Abre una mesa: cambia su estado a OCCUPIED y crea una orden nueva automáticamente.
 * El mozo selecciona la mesa en el mapa y la "abre" para empezar a tomar pedidos.
 */
export const openTable = asyncHandler(async (req: Request, res: Response) => {
    const serverId = req.user?.id;
    if (!serverId) {
        throw new UnauthorizedError('Not authenticated');
    }
    const tableId = tableIdSchema.parse(req.params.id);
    const pax = req.body?.pax ?? 1;

    const order = await tableService.openTableWithOrder(tableId, serverId, pax, req.user!.tenantId!);
    sendSuccess(res, order, undefined, 201);
});

/**
 * Cierra una mesa: procesa los pagos, cierra la orden y libera la mesa (estado FREE).
 * El cajero/mozo cierra la mesa cuando el cliente paga la cuenta completa.
 */
export const closeTable = asyncHandler(async (req: Request, res: Response) => {
    const serverId = req.user?.id;
    if (!serverId) {
        throw new UnauthorizedError('Not authenticated');
    }
    const tableId = tableIdSchema.parse(req.params.id);
    const payments = req.body?.payments;

    const result = await tableService.closeTableWithPayment(tableId, serverId, payments, req.user!.tenantId!);
    sendSuccess(res, result);
});
