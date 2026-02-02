/**
 * @fileoverview Controlador de Sincronización Offline
 *
 * Maneja la sincronización de datos entre el POS offline y el servidor.
 * Cuando el restaurante pierde conexión a internet, el frontend almacena
 * las órdenes y pagos localmente. Al reconectarse, los envía al servidor
 * mediante el endpoint push, que los procesa en orden y reporta resultados.
 *
 * Endpoints:
 * - pull: Descarga todos los datos necesarios para operar offline (productos, mesas, etc.)
 * - push: Sube las operaciones acumuladas durante el periodo offline
 * - status: Verifica conectividad y obtiene la hora del servidor
 *
 * @module controllers/sync.controller
 */

import { Request, Response } from 'express';
import { syncService } from '../services/sync.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';
import type { SyncPushRequest } from '../types/sync.types';

// ============================================================================
// ESQUEMAS DE VALIDACION
// ============================================================================

/** Esquema para un ítem dentro de una orden pendiente de sync */
const PendingOrderItemSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    modifiers: z.array(z.object({
        id: z.number().int().positive(),
        price: z.coerce.number() // Acepta strings y los convierte a number (ej: "1.5" -> 1.5)
    })).optional(),
    removedIngredientIds: z.array(z.number().int()).optional()
});

/** Esquema para una orden creada en modo offline */
const PendingOrderSchema = z.object({
    tempId: z.string().min(1),
    items: z.array(PendingOrderItemSchema).min(1),
    channel: z.enum(['POS', 'DELIVERY_APP', 'WAITER_APP', 'QR_MENU']),
    tableId: z.number().int().positive().optional(),
    clientId: z.number().int().positive().optional(),
    createdAt: z.string().datetime(),
    shiftId: z.number().int().positive().optional()
});

/** Esquema para un pago registrado en modo offline */
const PendingPaymentSchema = z.object({
    tempOrderId: z.string().min(1),
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'WALLET', 'OTHER']),
    amount: z.number().positive(),
    createdAt: z.string().datetime()
});

/** Esquema completo de la solicitud de sync push */
const SyncPushRequestSchema = z.object({
    clientId: z.string().min(1),
    pendingOrders: z.array(PendingOrderSchema),
    pendingPayments: z.array(PendingPaymentSchema)
});

/**
 * GET /api/v1/sync/pull
 * Descarga todos los datos necesarios para operar en modo offline:
 * productos, categorías, mesas, modificadores, métodos de pago, etc.
 */
export const pull = asyncHandler(async (req: Request, res: Response) => {
    const data = await syncService.pull(req.user!.tenantId!);

    res.json({
        success: true,
        data
    });
});

/**
 * POST /api/v1/sync/push
 * Sube las operaciones acumuladas durante el modo offline al servidor.
 * Procesa órdenes y pagos pendientes en orden cronológico.
 */
export const push = asyncHandler(async (req: Request, res: Response) => {
    // Validar el cuerpo de la solicitud con los esquemas definidos
    const validation = SyncPushRequestSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Invalid sync request', validation.error.issues);
    }

    // Obtener usuario del middleware de autenticación
    const userId = req.user?.id;
    if (!userId) {
        throw new ValidationError('User authentication required for sync');
    }

    const ip = String(req.ip || 'unknown');

    const result = await syncService.push(
        validation.data as SyncPushRequest,
        req.user!.tenantId!,
        {
            userId,
            ipAddress: ip
        }
    );

    res.json({
        success: result.success,
        data: result
    });
});

/**
 * GET /api/v1/sync/status
 * Verifica la conectividad con el servidor y devuelve la hora actual.
 * El frontend lo usa como heartbeat para detectar cuando vuelve la conexión.
 */
export const status = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            serverTime: new Date().toISOString(),
            online: true
        }
    });
});
