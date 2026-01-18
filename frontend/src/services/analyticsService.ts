import api from '../lib/api';

export interface SalesSummary {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  previousPeriodRevenue: number;
  revenueChange: number;
}

export interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
  percentage: number;
}

export interface ChannelSales {
  channel: string;
  total: number;
  count: number;
  percentage: number;
}

export interface LowStockItem {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  deficit: number;
}

export interface DailySales {
  date: string;
  total: number;
  count: number;
}

class AnalyticsService {
  async getSalesSummary(startDate?: string, endDate?: string): Promise<SalesSummary> {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await api.get('/analytics/summary', { params });
    return response.data.data;
  }

  async getTopProducts(limit: number = 10, startDate?: string, endDate?: string): Promise<TopProduct[]> {
    const params: Record<string, any> = { limit };
    if (startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    const response = await api.get('/analytics/top-products', { params });
    return response.data.data;
  }

  async getPaymentBreakdown(startDate?: string, endDate?: string): Promise<PaymentBreakdown[]> {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await api.get('/analytics/payments', { params });
    return response.data.data;
  }

  async getSalesByChannel(startDate?: string, endDate?: string): Promise<ChannelSales[]> {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await api.get('/analytics/channels', { params });
    return response.data.data;
  }

  async getLowStockItems(): Promise<LowStockItem[]> {
    const response = await api.get('/analytics/low-stock');
    return response.data.data;
  }

  async getDailySales(startDate?: string, endDate?: string): Promise<DailySales[]> {
    const params = startDate && endDate ? { startDate, endDate } : {};
    const response = await api.get('/analytics/daily-sales', { params });
    return response.data.data;
  }
}

export const analyticsService = new AnalyticsService();
