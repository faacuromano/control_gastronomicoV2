"use strict";
/**
 * Bulk Price Update Service
 * Handles mass price updates for products with preview and categorical updates
 *
 * @module services/bulkPriceUpdate.service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkPriceUpdateService = exports.BulkPriceUpdateService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class BulkPriceUpdateService {
    /**
     * Get all products with current prices for the bulk update grid
     */
    async getProductsForPriceGrid(filters) {
        const where = { isActive: true };
        if (filters?.categoryId) {
            where.categoryId = filters.categoryId;
        }
        const products = await prisma_1.prisma.product.findMany({
            where,
            include: { category: true },
            orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
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
     * Preview price changes without applying them
     */
    previewBulkUpdate(products, input) {
        return products.map(p => {
            let newPrice;
            if (input.type === 'PERCENTAGE') {
                newPrice = p.currentPrice * (1 + input.value / 100);
            }
            else {
                newPrice = p.currentPrice + input.value;
            }
            if (input.round) {
                newPrice = Math.round(newPrice);
            }
            // Ensure non-negative
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
     * Apply bulk price update to specific products by ID
     */
    async applyBulkUpdate(updates, context) {
        if (updates.length === 0) {
            throw new errors_1.ValidationError('No products to update');
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const changes = [];
            let totalPrevious = 0;
            let totalNew = 0;
            for (const update of updates) {
                const product = await tx.product.findUnique({
                    where: { id: update.id },
                    include: { category: true }
                });
                if (!product)
                    continue;
                const currentPrice = Number(product.price);
                const newPrice = Math.max(0, update.newPrice);
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
        // Log to audit trail
        await audit_service_1.auditService.log(client_1.AuditAction.BULK_PRICE_UPDATE, 'Product', null, context, {
            productsUpdated: result.productsUpdated,
            totalPreviousValue: result.totalPreviousValue,
            totalNewValue: result.totalNewValue,
            products: result.changes.map(c => ({ id: c.id, from: c.currentPrice, to: c.newPrice }))
        });
        logger_1.logger.info('Bulk price update applied', {
            productsUpdated: result.productsUpdated,
            totalChange: result.totalNewValue - result.totalPreviousValue
        });
        return result;
    }
    /**
     * Update prices by category with percentage/fixed increase
     */
    async updateByCategory(categoryId, input, context) {
        const products = await this.getProductsForPriceGrid({ categoryId });
        const previewed = this.previewBulkUpdate(products, input);
        const updates = previewed.map(p => ({
            id: p.id,
            newPrice: p.newPrice
        }));
        return this.applyBulkUpdate(updates, context);
    }
    /**
     * Get categories for dropdown
     */
    async getCategories() {
        return prisma_1.prisma.category.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        });
    }
}
exports.BulkPriceUpdateService = BulkPriceUpdateService;
exports.bulkPriceUpdateService = new BulkPriceUpdateService();
//# sourceMappingURL=bulkPriceUpdate.service.js.map