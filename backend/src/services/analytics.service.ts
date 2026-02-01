/**
 * @fileoverview Analytics service with database-level aggregations.
 * 
 * PERFORMANCE NOTE:
 * All aggregations are performed at the database level using Prisma's
 * aggregate/groupBy methods. This is much more efficient than loading
 * entire tables into memory.
 * 
 * @module services/analytics.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface SalesSummary {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  previousPeriodRevenue: number;
  revenueChange: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
  percentage: number;
}

interface ChannelSales {
  channel: string;
  total: number;
  count: number;
  percentage: number;
}

interface LowStockItem {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  deficit: number;
}

export class AnalyticsService {
  /**
   * Get sales summary for a date range using database aggregation.
   *
   * PERFORMANCE: Uses Prisma aggregate instead of loading all orders.
   * O(1) database query instead of O(n) memory processing.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param range - Date range for the query
   */
  async getSalesSummary(tenantId: number, range: DateRange): Promise<SalesSummary> {
    // Use database-level aggregation instead of loading all records
    const currentPeriod = await prisma.order.aggregate({
      where: {
        tenantId, // Multi-tenant isolation
        createdAt: {
          gte: range.startDate,
          lte: range.endDate
        },
        paymentStatus: 'PAID'
      },
      _sum: { total: true },
      _count: true
    });

    const totalRevenue = Number(currentPeriod._sum.total || 0);
    const orderCount = currentPeriod._count;
    const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Calculate previous period
    const periodMs = range.endDate.getTime() - range.startDate.getTime();
    const previousStart = new Date(range.startDate.getTime() - periodMs);
    const previousEnd = new Date(range.startDate.getTime() - 1);

    const previousPeriod = await prisma.order.aggregate({
      where: {
        tenantId, // Multi-tenant isolation
        createdAt: {
          gte: previousStart,
          lte: previousEnd
        },
        paymentStatus: 'PAID'
      },
      _sum: { total: true }
    });

    const previousPeriodRevenue = Number(previousPeriod._sum.total || 0);
    const revenueChange = previousPeriodRevenue > 0 
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
      : 0;

    return {
      totalRevenue,
      orderCount,
      averageTicket,
      previousPeriodRevenue,
      revenueChange
    };
  }

  /**
   * Get top selling products using database aggregation.
   *
   * PERFORMANCE: Uses Prisma groupBy instead of loading all order items.
   * O(n products) instead of O(n order items).
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param limit - Maximum number of products to return
   * @param range - Optional date range for the query
   */
  async getTopProducts(tenantId: number, limit: number = 10, range?: DateRange): Promise<TopProduct[]> {
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId, // Multi-tenant isolation
      paymentStatus: 'PAID',
      ...(range && {
        createdAt: {
          gte: range.startDate,
          lte: range.endDate
        }
      })
    };

    // Use groupBy for database-level aggregation
    const grouped = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: orderWhere
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: { quantity: 'desc' }
      },
      take: limit
    });

    // Now fetch product names (only for top N products)
    const productIds = grouped.map(g => g.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId // Multi-tenant isolation
      },
      select: { id: true, name: true, price: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate revenue - we need a second query for summed unit prices
    const revenueData = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: orderWhere,
        productId: { in: productIds }
      },
      _sum: {
        quantity: true
      }
    });

    // Calculate revenue using product prices
    return grouped.map(g => {
      const product = productMap.get(g.productId);
      const quantitySold = g._sum.quantity || 0;
      const price = product ? Number(product.price) : 0;
      
      return {
        productId: g.productId,
        productName: product?.name ?? 'Unknown',
        quantitySold,
        revenue: quantitySold * price
      };
    });
  }

  /**
   * Get payment method breakdown using database groupBy.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param range - Optional date range for the query
   */
  async getPaymentBreakdown(tenantId: number, range?: DateRange): Promise<PaymentBreakdown[]> {
    const whereClause: Prisma.PaymentWhereInput = {
      tenantId, // Multi-tenant isolation
      order: {
        paymentStatus: 'PAID',
        ...(range && {
          createdAt: {
            gte: range.startDate,
            lte: range.endDate
          }
        })
      }
    };

    const payments = await prisma.payment.groupBy({
      by: ['method'],
      where: whereClause,
      _sum: {
        amount: true
      },
      _count: true
    });

    const totalAmount = payments.reduce((sum, p) => sum + Number(p._sum.amount || 0), 0);

    return payments.map(p => ({
      method: p.method,
      total: Number(p._sum.amount || 0),
      count: p._count,
      percentage: totalAmount > 0 ? (Number(p._sum.amount || 0) / totalAmount) * 100 : 0
    }));
  }

  /**
   * Get sales by channel using database groupBy.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param range - Optional date range for the query
   */
  async getSalesByChannel(tenantId: number, range?: DateRange): Promise<ChannelSales[]> {
    const whereClause: Prisma.OrderWhereInput = {
      tenantId, // Multi-tenant isolation
      paymentStatus: 'PAID',
      ...(range && {
        createdAt: {
          gte: range.startDate,
          lte: range.endDate
        }
      })
    };

    const orders = await prisma.order.groupBy({
      by: ['channel'],
      where: whereClause,
      _sum: {
        total: true
      },
      _count: true
    });

    const totalAmount = orders.reduce((sum, o) => sum + Number(o._sum.total || 0), 0);

    return orders.map(o => ({
      channel: o.channel,
      total: Number(o._sum.total || 0),
      count: o._count,
      percentage: totalAmount > 0 ? (Number(o._sum.total || 0) / totalAmount) * 100 : 0
    }));
  }

  /**
   * Get ingredients with stock below minimum using raw SQL for efficiency.
   *
   * PERFORMANCE: Uses database-level WHERE filter instead of loading all ingredients.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   */
  async getLowStockItems(tenantId: number): Promise<LowStockItem[]> {
    // Use raw query to filter at database level
    const lowStock = await prisma.$queryRaw<{
      id: number;
      name: string;
      unit: string;
      stock: number;
      minStock: number;
    }[]>`
      SELECT id, name, unit,
             CAST(stock AS DECIMAL(10,4)) as stock,
             CAST(minStock AS DECIMAL(10,4)) as minStock
      FROM Ingredient
      WHERE tenantId = ${tenantId} AND stock < minStock
      ORDER BY (minStock - stock) DESC
    `;

    return lowStock.map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: Number(item.stock),
      minStock: Number(item.minStock),
      deficit: Number(item.minStock) - Number(item.stock)
    }));
  }

  /**
   * Get daily sales for charts using database groupBy with businessDate.
   *
   * PERFORMANCE: Uses groupBy on businessDate for efficient aggregation.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param range - Date range for the query
   */
  async getDailySales(tenantId: number, range: DateRange): Promise<{ date: string; total: number; count: number }[]> {
    // Group by businessDate which is already a DATE type
    const dailySales = await prisma.order.groupBy({
      by: ['businessDate'],
      where: {
        tenantId, // Multi-tenant isolation
        businessDate: {
          gte: range.startDate,
          lte: range.endDate
        },
        paymentStatus: 'PAID'
      },
      _sum: { total: true },
      _count: true,
      orderBy: { businessDate: 'asc' }
    });

    return dailySales.map(day => ({
      date: day.businessDate.toISOString().split('T')[0] ?? '',
      total: Number(day._sum.total || 0),
      count: day._count
    }));
  }
}

export const analyticsService = new AnalyticsService();
