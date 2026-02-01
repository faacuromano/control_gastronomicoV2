import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as AnalyticsController from '../controllers/analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/analytics/summary', requirePermission('analytics', 'read'), AnalyticsController.getSalesSummary);
router.get('/analytics/top-products', requirePermission('analytics', 'read'), AnalyticsController.getTopProducts);
router.get('/analytics/payments', requirePermission('analytics', 'read'), AnalyticsController.getPaymentBreakdown);
router.get('/analytics/channels', requirePermission('analytics', 'read'), AnalyticsController.getSalesByChannel);
router.get('/analytics/low-stock', requirePermission('analytics', 'read'), AnalyticsController.getLowStockItems);
router.get('/analytics/daily-sales', requirePermission('analytics', 'read'), AnalyticsController.getDailySales);

export default router;
