/**
 * @fileoverview Servicio de actualización masiva de precios.
 *
 * Permite actualizar precios de múltiples productos simultáneamente,
 * ya sea por porcentaje o monto fijo, con vista previa antes de aplicar.
 * Incluye soporte para actualización por categoría y registro en auditoría.
 *
 * @module services/bulkPriceUpdate.service
 */

import { prisma } from '../lib/prisma';
import { AuditAction, Prisma } from '@prisma/client';
import { auditService, AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

export type PriceUpdateType = 'PERCENTAGE' | 'FIXED';

export interface BulkPriceUpdateInput {
    type: PriceUpdateType;
    value: number;  // Cambio porcentual (+10 = +10%) o ajuste fijo (+5.00)
    round?: boolean | undefined; // Redondear al entero más cercano
}

export interface ProductPriceChange {
    id: number;
    name: string;
    categoryId: number;
    categoryName: string;
    currentPrice: number;
    newPrice: number;
    difference: number;
    percentChange: number;
}

export interface BulkUpdateResult {
    productsUpdated: number;
    totalPreviousValue: number;
    totalNewValue: number;
    changes: ProductPriceChange[];
}

export class BulkPriceUpdateService {

    /**
     * Obtiene todos los productos con precios actuales para la grilla de actualización masiva.
     * Permite filtrar opcionalmente por categoría.
     */
    async getProductsForPriceGrid(tenantId: number, filters?: { categoryId?: number | undefined }): Promise<ProductPriceChange[]> {
        const where: Prisma.ProductWhereInput = { isActive: true, tenantId };
        if (filters?.categoryId) {
            where.categoryId = filters.categoryId;
        }

        // PERF-012: Limitar resultados para evitar consultas sin cota en tenants con muchos productos
        const products = await prisma.product.findMany({
            where,
            include: { category: true },
            orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
            take: 500
        });

        return products.map(p => ({
            id: p.id,
            name: p.name,
            categoryId: p.categoryId,
            categoryName: p.category.name,
            currentPrice: Number(p.price),
            newPrice: Number(p.price),
            difference: 0,
            percentChange: 0
        }));
    }

    /**
     * Calcula la vista previa de cambios de precio sin aplicarlos.
     * Útil para que el usuario revise los cambios antes de confirmar.
     */
    previewBulkUpdate(
        products: ProductPriceChange[],
        input: BulkPriceUpdateInput
    ): ProductPriceChange[] {
        return products.map(p => {
            let newPrice: number;

            if (input.type === 'PERCENTAGE') {
                newPrice = p.currentPrice * (1 + input.value / 100);
            } else {
                newPrice = p.currentPrice + input.value;
            }

            if (input.round) {
                newPrice = Math.round(newPrice);
            }

            // Asegurar que el precio nunca sea negativo
            newPrice = Math.max(0, newPrice);

            return {
                ...p,
                newPrice,
                difference: newPrice - p.currentPrice,
                percentChange: p.currentPrice > 0
                    ? ((newPrice - p.currentPrice) / p.currentPrice) * 100
                    : 0
            };
        });
    }

    /**
     * Aplica la actualización masiva de precios a productos específicos por ID.
     * Ejecuta todas las actualizaciones en una transacción atómica y registra en auditoría.
     */
    async applyBulkUpdate(
        tenantId: number,
        updates: { id: number; newPrice: number }[],
        context: AuditContext
    ): Promise<BulkUpdateResult> {
        if (updates.length === 0) {
            throw new ValidationError('No products to update');
        }

        const result = await prisma.$transaction(async (tx) => {
            const changes: ProductPriceChange[] = [];
            let totalPrevious = 0;
            let totalNew = 0;

            for (const update of updates) {
                const product = await tx.product.findFirst({
                    where: { id: update.id, tenantId },
                    include: { category: true }
                });

                if (!product) continue;

                const currentPrice = Number(product.price);
                const newPrice = Math.max(0, update.newPrice);

                // SAFE: tx.product.findFirst en L121 verifica propiedad del tenant
                await tx.product.update({
                    where: { id: update.id },
                    data: { price: newPrice }
                });

                changes.push({
                    id: product.id,
                    name: product.name,
                    categoryId: product.categoryId,
                    categoryName: product.category.name,
                    currentPrice,
                    newPrice,
                    difference: newPrice - currentPrice,
                    percentChange: currentPrice > 0
                        ? ((newPrice - currentPrice) / currentPrice) * 100
                        : 0
                });

                totalPrevious += currentPrice;
                totalNew += newPrice;
            }

            return {
                productsUpdated: changes.length,
                totalPreviousValue: totalPrevious,
                totalNewValue: totalNew,
                changes
            };
        });

        // Registrar operación en la pista de auditoría
        await auditService.log(
            AuditAction.BULK_PRICE_UPDATE,
            'Product',
            null,
            context,
            {
                productsUpdated: result.productsUpdated,
                totalPreviousValue: result.totalPreviousValue,
                totalNewValue: result.totalNewValue,
                products: result.changes.map(c => ({ id: c.id, from: c.currentPrice, to: c.newPrice }))
            }
        );

        logger.info('Bulk price update applied', {
            productsUpdated: result.productsUpdated,
            totalChange: result.totalNewValue - result.totalPreviousValue
        });

        return result;
    }

    /**
     * Actualiza precios de todos los productos de una categoría con un ajuste porcentual o fijo.
     * Combina getProductsForPriceGrid + previewBulkUpdate + applyBulkUpdate en un solo flujo.
     */
    async updateByCategory(
        tenantId: number,
        categoryId: number,
        input: BulkPriceUpdateInput,
        context: AuditContext
    ): Promise<BulkUpdateResult> {
        const products = await this.getProductsForPriceGrid(tenantId, { categoryId });
        const previewed = this.previewBulkUpdate(products, input);

        const updates = previewed.map(p => ({
            id: p.id,
            newPrice: p.newPrice
        }));

        return this.applyBulkUpdate(tenantId, updates, context);
    }

    /**
     * Obtiene las categorías disponibles para el dropdown de selección en la UI.
     */
    async getCategories(tenantId: number) {
        return prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        });
    }
}

export const bulkPriceUpdateService = new BulkPriceUpdateService();
