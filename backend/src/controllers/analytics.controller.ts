import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { analyticsService } from '../services/analytics.service';

/**
 * Parse date range from query params
 */
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

function parseDateRange(query: any): { startDate: Date; endDate: Date } | undefined {
  const { startDate, endDate } = dateRangeSchema.parse(query);
  
  if (!startDate || !endDate) {
    return undefined;
  }
  
  // Parse start date at beginning of day (in local timezone)
  // Using Date(year, month, day) creates a date in LOCAL time, not UTC
  const startParts = startDate.split('-').map(Number);
  const start = new Date(startParts[0]!, startParts[1]! - 1, startParts[2]!, 0, 0, 0, 0);
  
  // Parse end date at END of day (23:59:59.999) in local timezone
  const endParts = endDate.split('-').map(Number);
  const end = new Date(endParts[0]!, endParts[1]! - 1, endParts[2]!, 23, 59, 59, 999);
  
  return {
    startDate: start,
    endDate: end
  };
}

/**
 * Get today's date range
 */
function getTodayRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { startDate, endDate };
}

/**
 * Get sales summary
 */
export const getSalesSummary = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query) || getTodayRange();
  const summary = await analyticsService.getSalesSummary(range);
  res.json({ success: true, data: summary });
});

/**
 * Get top products
 */
export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const range = parseDateRange(req.query);
  const products = await analyticsService.getTopProducts(limit, range);
  res.json({ success: true, data: products });
});

/**
 * Get payment method breakdown
 */
export const getPaymentBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query);
  const breakdown = await analyticsService.getPaymentBreakdown(range);
  res.json({ success: true, data: breakdown });
});

/**
 * Get sales by channel
 */
export const getSalesByChannel = asyncHandler(async (req: Request, res: Response) => {
  const range = parseDateRange(req.query);
  const channels = await analyticsService.getSalesByChannel(range);
  res.json({ success: true, data: channels });
});

/**
 * Get low stock items
 */
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await analyticsService.getLowStockItems();
  res.json({ success: true, data: items });
});

/**
 * Get daily sales for charts
 */
export const getDailySales = asyncHandler(async (req: Request, res: Response) => {
  // Default to last 30 days if no range provided
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const range = parseDateRange(req.query) || { startDate: defaultStart, endDate: now };
  
  const sales = await analyticsService.getDailySales(range);
  res.json({ success: true, data: sales });
});
