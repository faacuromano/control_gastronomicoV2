"use strict";
/**
 * @fileoverview Print Routing Service (Toast-style).
 * Determines which printer should receive order items based on:
 * 1. Area-specific overrides (highest priority)
 * 2. Category-assigned printers (default routing)
 *
 * @module services/printRouting.service
 * @pattern Strategy - Different routing strategies based on context
 *
 * @example
 * // Get routing for an order
 * const routes = await printRoutingService.getRoutingForOrder(orderId);
 * // returns Map<printerId, OrderItem[]>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.printRoutingService = exports.PrintRoutingService = void 0;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
class PrintRoutingService {
    /**
     * Get print routing for an order.
     * Groups order items by destination printer.
     *
     * @param orderId - Order ID to route
     * @returns RoutingResult with routes and unrouted items
     */
    async getRoutingForOrder(orderId) {
        // 1. Get order with items, products, categories
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                table: {
                    include: {
                        area: {
                            include: {
                                printerOverrides: {
                                    include: { printer: true }
                                }
                            }
                        }
                    }
                },
                items: {
                    include: {
                        product: {
                            include: {
                                category: {
                                    include: { printer: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }
        // 2. Get area overrides (if order has a table)
        const areaOverrides = order.table?.area?.printerOverrides ?? [];
        // Build override lookup: categoryId -> printerId
        // categoryId = null means "all categories" for this area
        const overrideMap = new Map();
        for (const override of areaOverrides) {
            overrideMap.set(override.categoryId, {
                printerId: override.printerId,
                printerName: override.printer.name
            });
        }
        // Check for area-wide override (categoryId = null)
        const areaWideOverride = overrideMap.get(null);
        // 3. Route each item to appropriate printer
        const routeMap = new Map();
        const unrouted = [];
        for (const item of order.items) {
            const categoryId = item.product.categoryId;
            let targetPrinter = null;
            // Priority 1: Category-specific override for this area
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId);
            }
            // Priority 2: Area-wide override (applies to all categories)
            else if (areaWideOverride) {
                targetPrinter = areaWideOverride;
            }
            // Priority 3: Default category printer
            else if (item.product.category.printerId && item.product.category.printer) {
                targetPrinter = {
                    printerId: item.product.category.printerId,
                    printerName: item.product.category.printer.name
                };
            }
            // Add to route or unrouted list
            if (targetPrinter) {
                if (!routeMap.has(targetPrinter.printerId)) {
                    routeMap.set(targetPrinter.printerId, {
                        printerId: targetPrinter.printerId,
                        printerName: targetPrinter.printerName,
                        items: []
                    });
                }
                routeMap.get(targetPrinter.printerId).items.push(item);
            }
            else {
                unrouted.push(item);
            }
        }
        const result = {
            routes: Array.from(routeMap.values()),
            unrouted
        };
        logger_1.logger.debug('Print routing calculated', {
            orderId,
            areaId: order.table?.areaId,
            routeCount: result.routes.length,
            unroutedCount: result.unrouted.length
        });
        return result;
    }
    /**
     * Get routing for specific items (for partial prints like "add items").
     *
     * @param items - Items to route
     * @param areaId - Optional area ID for override lookup
     */
    async getRoutingForItems(items, areaId) {
        // Get products with categories
        const productIds = items.map(i => i.productId);
        const products = await prisma_1.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: {
                category: {
                    include: { printer: true }
                }
            }
        });
        const productMap = new Map(products.map(p => [p.id, p]));
        // Get area overrides if areaId provided
        let overrideMap = new Map();
        let areaWideOverride = null;
        if (areaId) {
            const overrides = await prisma_1.prisma.areaPrinterOverride.findMany({
                where: { areaId },
                include: { printer: true }
            });
            for (const override of overrides) {
                overrideMap.set(override.categoryId, {
                    printerId: override.printerId,
                    printerName: override.printer.name
                });
            }
            areaWideOverride = overrideMap.get(null) ?? null;
        }
        // Route items
        const routeMap = new Map();
        const unrouted = [];
        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product)
                continue;
            const categoryId = product.categoryId;
            let targetPrinter = null;
            // Priority 1: Category-specific override
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId);
            }
            // Priority 2: Area-wide override
            else if (areaWideOverride) {
                targetPrinter = areaWideOverride;
            }
            // Priority 3: Category default
            else if (product.category.printerId && product.category.printer) {
                targetPrinter = {
                    printerId: product.category.printerId,
                    printerName: product.category.printer.name
                };
            }
            const routingItem = {
                id: 0, // Not persisted yet
                productId: item.productId,
                quantity: item.quantity,
                notes: item.notes ?? null,
                product: {
                    id: product.id,
                    name: product.name,
                    categoryId: product.categoryId,
                    category: {
                        id: product.category.id,
                        name: product.category.name,
                        printerId: product.category.printerId
                    }
                }
            };
            if (targetPrinter) {
                if (!routeMap.has(targetPrinter.printerId)) {
                    routeMap.set(targetPrinter.printerId, {
                        printerId: targetPrinter.printerId,
                        printerName: targetPrinter.printerName,
                        items: []
                    });
                }
                routeMap.get(targetPrinter.printerId).items.push(routingItem);
            }
            else {
                unrouted.push(routingItem);
            }
        }
        return {
            routes: Array.from(routeMap.values()),
            unrouted
        };
    }
    /**
     * Get all printers configured for routing (for admin UI).
     */
    async getRoutingConfiguration() {
        const [categories, areas, printers] = await Promise.all([
            prisma_1.prisma.category.findMany({
                include: { printer: true },
                orderBy: { name: 'asc' }
            }),
            prisma_1.prisma.area.findMany({
                include: {
                    printerOverrides: {
                        include: { printer: true, category: true }
                    }
                },
                orderBy: { name: 'asc' }
            }),
            prisma_1.prisma.printer.findMany({
                orderBy: { name: 'asc' }
            })
        ]);
        return {
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                printerId: c.printerId,
                printerName: c.printer?.name ?? null
            })),
            areas: areas.map(a => ({
                id: a.id,
                name: a.name,
                overrides: a.printerOverrides.map(o => ({
                    id: o.id,
                    categoryId: o.categoryId,
                    categoryName: o.category?.name ?? 'All Categories',
                    printerId: o.printerId,
                    printerName: o.printer.name
                }))
            })),
            printers: printers.map(p => ({
                id: p.id,
                name: p.name,
                connectionType: p.connectionType
            }))
        };
    }
    /**
     * Set category default printer.
     */
    async setCategoryPrinter(categoryId, printerId) {
        return prisma_1.prisma.category.update({
            where: { id: categoryId },
            data: { printerId }
        });
    }
    /**
     * Set area printer override.
     * If categoryId is null, sets an area-wide override (all categories).
     */
    async setAreaOverride(areaId, categoryId, printerId) {
        // Prisma doesn't generate compound unique for nullable fields correctly
        // Use upsert with where clause that handles null
        const existing = await prisma_1.prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId }
        });
        if (existing) {
            return prisma_1.prisma.areaPrinterOverride.update({
                where: { id: existing.id },
                data: { printerId }
            });
        }
        else {
            return prisma_1.prisma.areaPrinterOverride.create({
                data: { areaId, categoryId, printerId }
            });
        }
    }
    /**
     * Remove area printer override.
     */
    async removeAreaOverride(areaId, categoryId) {
        // Find and delete since compound unique with nullable doesn't work directly
        const existing = await prisma_1.prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId }
        });
        if (existing) {
            return prisma_1.prisma.areaPrinterOverride.delete({
                where: { id: existing.id }
            });
        }
        return null;
    }
    /**
     * Set area-wide override (all categories go to one printer).
     */
    async setAreaWideOverride(areaId, printerId) {
        return this.setAreaOverride(areaId, null, printerId);
    }
    /**
     * Remove area-wide override.
     */
    async removeAreaWideOverride(areaId) {
        return this.removeAreaOverride(areaId, null);
    }
}
exports.PrintRoutingService = PrintRoutingService;
exports.printRoutingService = new PrintRoutingService();
//# sourceMappingURL=printRouting.service.js.map