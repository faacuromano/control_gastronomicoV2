/**
 * @fileoverview Controlador de Analíticas y Reportes de Ventas
 *
 * Provee endpoints para obtener métricas clave del negocio gastronómico:
 * resumen de ventas, productos más vendidos, desglose por método de pago,
 * ventas por canal y alertas de stock bajo. Todos los datos se filtran
 * por tenant (multi-tenant) y opcionalmente por rango de fechas.
 *
 * @module controllers/analytics.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/response';

/**
 * Esquema Zod para parsear y validar el rango de fechas desde query params.
 * Se exige formato estricto YYYY-MM-DD para evitar inyección o formatos ambiguos (fix P2-005).
 */
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional()
});

/**
 * Convierte los strings de fecha del query en objetos Date con hora inicio (00:00:00) y fin (23:59:59).
 * Retorna undefined si no se proporcionan ambas fechas o si las fechas parseadas son inválidas.
 */
function parseDateRange(query: Record<string, unknown>): { startDate: Date; endDate: Date } | undefined {
  const { startDate, endDate } = dateRangeSchema.parse(query);

  if (!startDate || !endDate) {
    return undefined;
  }

  const startParts = startDate.split('-').map(Number);
  const start = new Date(startParts[0]!, startParts[1]! - 1, startParts[2]!, 0, 0, 0, 0);

  const endParts = endDate.split('-').map(Number);
  const end = new Date(endParts[0]!, endParts[1]! - 1, endParts[2]!, 23, 59, 59, 999);

  // Validar que las fechas parseadas sean reales (ej: 2024-02-30 daría NaN)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return undefined;
  }

  return {
    startDate: start,
    endDate: end
  };
}

/**
 * Genera el rango de fechas del día actual (desde las 00:00 hasta las 23:59).
 * Se usa como fallback cuando el cliente no envía un rango explícito.
 */
function getTodayRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { startDate, endDate };
}

/**
 * Obtiene el resumen de ventas (total vendido, cantidad de órdenes, ticket promedio, etc.).
 * Si no se envía rango de fechas, usa el día actual por defecto.
 */
export const getSalesSummary = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query) || getTodayRange();
  const summary = await analyticsService.getSalesSummary(req.user!.tenantId!, range);
  sendSuccess(res, summary );
});

/**
 * Obtiene los productos más vendidos ordenados por cantidad.
 * El parámetro `limit` controla cuántos productos devolver (máx. 100, por defecto 10).
 */
export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  const range = parseDateRange(req.query);
  const products = await analyticsService.getTopProducts(req.user!.tenantId!, limit, range);
  sendSuccess(res, products );
});

/**
 * Obtiene el desglose de ventas por método de pago (efectivo, tarjeta, transferencia, etc.).
 * Útil para el dashboard de caja y reportes contables.
 */
export const getPaymentBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query);
  const breakdown = await analyticsService.getPaymentBreakdown(req.user!.tenantId!, range);
  sendSuccess(res, breakdown );
});

/**
 * Obtiene las ventas agrupadas por canal (POS, delivery, QR, app de mozo).
 * Permite al negocio entender de dónde provienen sus ingresos.
 */
export const getSalesByChannel = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query);
  const channels = await analyticsService.getSalesByChannel(req.user!.tenantId!, range);
  sendSuccess(res, channels );
});

/**
 * Obtiene los ingredientes con stock por debajo del mínimo configurado.
 * No requiere rango de fechas porque refleja el estado actual del inventario.
 */
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await analyticsService.getLowStockItems(req.user!.tenantId!);
  sendSuccess(res, items );
});

/**
 * Obtiene las ventas diarias para gráficos de tendencia.
 * Si no se envía rango, usa los últimos 30 días por defecto.
 */
export const getDailySales = asyncHandler(async (req: Request, res: Response) => {
  // Por defecto últimos 30 días si no se proporciona rango
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const range = parseDateRange(req.query) || { startDate: defaultStart, endDate: now };

  const sales = await analyticsService.getDailySales(req.user!.tenantId!, range);
  sendSuccess(res, sales );
});
