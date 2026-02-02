/**
 * @fileoverview Servicio de analíticas con agregaciones a nivel de base de datos.
 *
 * NOTA DE RENDIMIENTO:
 * Todas las agregaciones se ejecutan directamente en la base de datos usando los métodos
 * aggregate/groupBy de Prisma. Esto es mucho más eficiente que cargar tablas completas
 * en memoria y procesarlas en Node.js.
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
   * Obtiene el resumen de ventas para un rango de fechas usando agregación en BD.
   *
   * RENDIMIENTO: Usa Prisma aggregate en vez de cargar todas las órdenes en memoria.
   * Una sola consulta O(1) en lugar de procesar O(n) registros en el servidor.
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   * @param range - Rango de fechas para la consulta
   */
  async getSalesSummary(tenantId: number, range: DateRange): Promise<SalesSummary> {
    // Agregación a nivel de BD: evita traer todos los registros a memoria
    const currentPeriod = await prisma.order.aggregate({
      where: {
        tenantId, // Aislamiento multi-inquilino
        createdAt: {
          gte: range.startDate,
          lte: range.endDate
        },
        paymentStatus: 'PAID'
      },
      _sum: { total: true },
      _count: true
    });

    // BIZ-008: Redondeo a 2 decimales para precisión financiera
    const totalRevenue = Math.round(Number(currentPeriod._sum.total || 0) * 100) / 100;
    const orderCount = currentPeriod._count;
    const averageTicket = orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0;

    // Calcular el período anterior (mismo ancho temporal hacia atrás)
    const periodMs = range.endDate.getTime() - range.startDate.getTime();
    const previousStart = new Date(range.startDate.getTime() - periodMs);
    const previousEnd = new Date(range.startDate.getTime() - 1);

    const previousPeriod = await prisma.order.aggregate({
      where: {
        tenantId, // Aislamiento multi-inquilino
        createdAt: {
          gte: previousStart,
          lte: previousEnd
        },
        paymentStatus: 'PAID'
      },
      _sum: { total: true }
    });

    const previousPeriodRevenue = Math.round(Number(previousPeriod._sum.total || 0) * 100) / 100;
    const revenueChange = previousPeriodRevenue > 0
      ? Math.round(((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 10000) / 100
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
   * Obtiene los productos más vendidos usando agregación en BD.
   *
   * RENDIMIENTO: Usa Prisma groupBy en vez de cargar todos los items de órdenes.
   * Complejidad O(n productos) en lugar de O(n items de órdenes).
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   * @param limit - Cantidad máxima de productos a retornar
   * @param range - Rango de fechas opcional para filtrar
   */
  async getTopProducts(tenantId: number, limit: number = 10, range?: DateRange): Promise<TopProduct[]> {
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId, // Aislamiento multi-inquilino
      paymentStatus: 'PAID',
      ...(range && {
        createdAt: {
          gte: range.startDate,
          lte: range.endDate
        }
      })
    };

    // groupBy a nivel de BD para agregar cantidades por producto
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

    // Obtener nombres de producto solo para los top N (consulta ligera)
    const productIds = grouped.map(g => g.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId // Aislamiento multi-inquilino
      },
      select: { id: true, name: true, price: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Segunda agregación para obtener datos de ingresos por producto
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

    // Calcular ingresos usando el precio unitario del producto
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
   * Obtiene el desglose de métodos de pago usando groupBy en BD.
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   * @param range - Rango de fechas opcional para filtrar
   */
  async getPaymentBreakdown(tenantId: number, range?: DateRange): Promise<PaymentBreakdown[]> {
    const whereClause: Prisma.PaymentWhereInput = {
      tenantId, // Aislamiento multi-inquilino
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

    const totalAmount = Math.round(payments.reduce((sum, p) => sum + Number(p._sum.amount || 0), 0) * 100) / 100;

    return payments.map(p => ({
      method: p.method,
      total: Math.round(Number(p._sum.amount || 0) * 100) / 100,
      count: p._count,
      percentage: totalAmount > 0 ? Math.round((Number(p._sum.amount || 0) / totalAmount) * 10000) / 100 : 0
    }));
  }

  /**
   * Obtiene las ventas agrupadas por canal de venta usando groupBy en BD.
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   * @param range - Rango de fechas opcional para filtrar
   */
  async getSalesByChannel(tenantId: number, range?: DateRange): Promise<ChannelSales[]> {
    const whereClause: Prisma.OrderWhereInput = {
      tenantId, // Aislamiento multi-inquilino
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

    const totalAmount = Math.round(orders.reduce((sum, o) => sum + Number(o._sum.total || 0), 0) * 100) / 100;

    return orders.map(o => ({
      channel: o.channel,
      total: Math.round(Number(o._sum.total || 0) * 100) / 100,
      count: o._count,
      percentage: totalAmount > 0 ? Math.round((Number(o._sum.total || 0) / totalAmount) * 10000) / 100 : 0
    }));
  }

  /**
   * Obtiene ingredientes con stock por debajo del mínimo usando SQL crudo.
   *
   * RENDIMIENTO: Filtra directamente en la BD con WHERE en vez de cargar todos
   * los ingredientes a memoria y filtrar en Node.js.
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   */
  async getLowStockItems(tenantId: number): Promise<LowStockItem[]> {
    // Consulta cruda para filtrar a nivel de BD (más eficiente que findMany + filter)
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
   * Obtiene las ventas diarias para gráficos usando groupBy sobre businessDate.
   *
   * RENDIMIENTO: Agrupa por businessDate (tipo DATE en BD) para obtener
   * series temporales sin procesar en memoria.
   *
   * @param tenantId - ID del tenant para aislamiento multi-inquilino
   * @param range - Rango de fechas para la consulta
   */
  async getDailySales(tenantId: number, range: DateRange): Promise<{ date: string; total: number; count: number }[]> {
    // Agrupar por businessDate que ya es un tipo DATE en la BD
    const dailySales = await prisma.order.groupBy({
      by: ['businessDate'],
      where: {
        tenantId, // Aislamiento multi-inquilino
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
