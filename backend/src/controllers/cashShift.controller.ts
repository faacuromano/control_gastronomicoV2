/**
 * @fileoverview Controlador de Turnos de Caja
 *
 * Gestiona el ciclo de vida de los turnos de caja: apertura con monto inicial,
 * cierre con arqueo (conteo de efectivo), generación de reportes de turno
 * y consulta de historial. Cada operación se registra en auditoría.
 *
 * Un turno de caja es el período durante el cual un cajero opera la caja
 * registradora. Al cerrar, se compara el efectivo contado con el esperado
 * para detectar diferencias (sobrantes/faltantes).
 *
 * @module controllers/cashShift.controller
 */

import { Request, Response } from 'express';
import { cashShiftService } from '../services/cashShift.service';
import { sendSuccess } from '../utils/response';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { auditService, getAuditContext } from '../services/audit.service';

/** Esquema de validación para apertura de turno: monto inicial en caja */
const openShiftSchema = z.object({
    startAmount: z.number().min(0)
});

/** Esquema de validación para cierre con arqueo: monto de efectivo contado */
const closeShiftSchema = z.object({
    countedCash: z.number().min(0)
});

/**
 * Abre un nuevo turno de caja para el usuario autenticado.
 * Requiere que no exista un turno abierto previo para el mismo usuario.
 */
export const openShift = asyncHandler(async (req: Request, res: Response) => {
    const { startAmount } = openShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();

    const result = await cashShiftService.openShift(req.user!.tenantId!, userId, startAmount);

    // Auditoría: registrar apertura de turno
    await auditService.logCashShift('SHIFT_OPENED', result.id, getAuditContext(req), {
        startAmount,
        userName: req.user?.name
    });

    return sendSuccess(res, result);
});

/**
 * Cierra el turno actual con arqueo de caja.
 * Calcula la diferencia entre el efectivo contado y el esperado según los pagos registrados.
 * Devuelve un reporte completo con ventas, métodos de pago y diferencia de caja.
 */
export const closeShiftWithCount = asyncHandler(async (req: Request, res: Response) => {
    const { countedCash } = closeShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();

    const report = await cashShiftService.closeShiftWithCount(req.user!.tenantId!, userId, countedCash);

    // Auditoría: registrar cierre con detalle del arqueo
    await auditService.logCashShift('SHIFT_CLOSED', report.shift.id, getAuditContext(req), {
        countedCash,
        expectedCash: report.cash.expectedCash,
        difference: report.cash.difference,
        totalSales: report.sales.totalSales
    });

    return sendSuccess(res, report);
});

/**
 * Obtiene el reporte detallado de un turno específico por su ID.
 * Incluye totales de ventas, desglose por método de pago y diferencia de caja.
 */
export const getShiftReport = asyncHandler(async (req: Request, res: Response) => {
    const shiftId = Number(req.params.id);
    if (!shiftId || isNaN(shiftId)) {
        throw new ValidationError('Invalid shift ID');
    }
    const report = await cashShiftService.getShiftReport(shiftId, req.user!.tenantId!);
    return sendSuccess(res, report);
});

/**
 * Obtiene el turno actualmente abierto del usuario autenticado.
 * Retorna null si no hay turno abierto (el frontend usa esto para mostrar/ocultar el POS).
 */
export const getCurrentShift = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();

    const result = await cashShiftService.getCurrentShift(req.user!.tenantId!, userId);
    return sendSuccess(res, result);
});

/**
 * Cierre simple de turno (legacy). Se mantiene por compatibilidad con versiones anteriores
 * del frontend que solo envían endAmount sin hacer arqueo detallado.
 */
export const closeShift = asyncHandler(async (req: Request, res: Response) => {
    const { endAmount } = z.object({ endAmount: z.number().min(0) }).parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();

    const result = await cashShiftService.closeShift(req.user!.tenantId!, userId, endAmount);

    // Auditoría: registrar cierre de turno
    await auditService.logCashShift('SHIFT_CLOSED', result.id, getAuditContext(req), {
        endAmount,
        userName: req.user?.name
    });

    return sendSuccess(res, result);
});

/**
 * Obtiene todos los turnos con filtros opcionales para el dashboard de analíticas.
 * Permite filtrar por fecha (ISO 8601) y por userId para ver turnos de un cajero específico.
 */
export const getAllShifts = asyncHandler(async (req: Request, res: Response) => {
    const fromDate = req.query.fromDate as string | undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    // FIX IP-006: Validar formato ISO 8601 para prevenir inyección en consultas de fecha
    if (fromDate) {
        const dateSchema = z.string().datetime();
        const validation = dateSchema.safeParse(fromDate);
        if (!validation.success) {
            throw new ValidationError(`Invalid date format for fromDate. Expected ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ), got: ${fromDate}`);
        }
    }

    // Construir objeto de filtros solo con valores definidos
    const filters: { fromDate?: string; userId?: number } = {};
    if (fromDate) filters.fromDate = fromDate;
    if (userId) filters.userId = userId;

    const shifts = await cashShiftService.getAll(req.user!.tenantId!, filters);
    return sendSuccess(res, shifts);
});
