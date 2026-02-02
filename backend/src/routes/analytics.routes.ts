/**
 * @fileoverview Rutas de Analíticas y Reportes de Ventas
 *
 * Define los endpoints para consultar métricas del negocio: resumen de ventas,
 * productos más vendidos, desglose por método de pago, ventas por canal,
 * artículos con bajo stock y ventas diarias. Todas las rutas requieren
 * autenticación y permiso de lectura sobre el recurso 'analytics'.
 *
 * Se monta bajo el prefijo /api/v1/ en app.ts.
 *
 * @module routes/analytics.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as AnalyticsController from '../controllers/analytics.controller';

const router = Router();

// Todas las rutas de analíticas requieren usuario autenticado
router.use(authenticate);

// Resumen general de ventas (totales, promedios, conteos) para el dashboard principal
router.get('/analytics/summary', requirePermission('analytics', 'read'), AnalyticsController.getSalesSummary);

// Ranking de productos más vendidos, útil para decisiones de menú y stock
router.get('/analytics/top-products', requirePermission('analytics', 'read'), AnalyticsController.getTopProducts);

// Desglose de cobros por método de pago (efectivo, tarjeta, transferencia, etc.)
router.get('/analytics/payments', requirePermission('analytics', 'read'), AnalyticsController.getPaymentBreakdown);

// Distribución de ventas por canal (POS, QR, delivery, app de mesero)
router.get('/analytics/channels', requirePermission('analytics', 'read'), AnalyticsController.getSalesByChannel);

// Ingredientes con stock por debajo del mínimo configurado
router.get('/analytics/low-stock', requirePermission('analytics', 'read'), AnalyticsController.getLowStockItems);

// Serie temporal de ventas diarias para gráficos de tendencia
router.get('/analytics/daily-sales', requirePermission('analytics', 'read'), AnalyticsController.getDailySales);

export default router;
