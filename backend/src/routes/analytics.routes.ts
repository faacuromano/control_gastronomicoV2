import { Router } from 'express';
import * as AnalyticsController from '../controllers/analytics.controller';

const router = Router();

router.get('/analytics/summary', AnalyticsController.getSalesSummary);
router.get('/analytics/top-products', AnalyticsController.getTopProducts);
router.get('/analytics/payments', AnalyticsController.getPaymentBreakdown);
router.get('/analytics/channels', AnalyticsController.getSalesByChannel);
router.get('/analytics/low-stock', AnalyticsController.getLowStockItems);
router.get('/analytics/daily-sales', AnalyticsController.getDailySales);

export default router;
