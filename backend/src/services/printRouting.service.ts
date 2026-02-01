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

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

interface OrderItemForRouting {
    id: number;
    productId: number;
    quantity: number;
    notes: string | null;
    product: {
        id: number;
        name: string;
        categoryId: number;
        category: {
            id: number;
            name: string;
            printerId: number | null;
        };
    };
}

interface PrintRoute {
    printerId: number;
    printerName: string;
    items: OrderItemForRouting[];
}

interface RoutingResult {
    routes: PrintRoute[];
    unrouted: OrderItemForRouting[];  // Items without assigned printer
}

export class PrintRoutingService {
    /**
     * Get print routing for an order.
     * Groups order items by destination printer.
     * 
     * @param orderId - Order ID to route
     * @returns RoutingResult with routes and unrouted items
     */
    async getRoutingForOrder(orderId: number, tenantId: number): Promise<RoutingResult> {
        // 1. Get order with items, products, categories
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
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
        const overrideMap = new Map<number | null, { printerId: number; printerName: string }>();
        for (const override of areaOverrides) {
            overrideMap.set(override.categoryId, {
                printerId: override.printerId,
                printerName: override.printer.name
            });
        }

        // Check for area-wide override (categoryId = null)
        const areaWideOverride = overrideMap.get(null);

        // 3. Route each item to appropriate printer
        const routeMap = new Map<number, PrintRoute>();
        const unrouted: OrderItemForRouting[] = [];

        for (const item of order.items) {
            const categoryId = item.product.categoryId;
            let targetPrinter: { printerId: number; printerName: string } | null = null;

            // Priority 1: Category-specific override for this area
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId)!;
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
                routeMap.get(targetPrinter.printerId)!.items.push(item);
            } else {
                unrouted.push(item);
            }
        }

        const result: RoutingResult = {
            routes: Array.from(routeMap.values()),
            unrouted
        };

        logger.debug('Print routing calculated', {
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
    async getRoutingForItems(
        tenantId: number,
        items: Array<{ productId: number; quantity: number; notes?: string }>,
        areaId?: number
    ): Promise<RoutingResult> {
        // Get products with categories
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId },
            include: {
                category: {
                    include: { printer: true }
                }
            }
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        // Get area overrides if areaId provided
        let overrideMap = new Map<number | null, { printerId: number; printerName: string }>();
        let areaWideOverride: { printerId: number; printerName: string } | null = null;

        if (areaId) {
            // Verify area ownership
            const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
            if (!area) throw new Error('Area not found or access denied');

            const overrides = await prisma.areaPrinterOverride.findMany({
                where: { areaId, tenantId },
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
        const routeMap = new Map<number, PrintRoute>();
        const unrouted: OrderItemForRouting[] = [];

        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product) continue;

            const categoryId = product.categoryId;
            let targetPrinter: { printerId: number; printerName: string } | null = null;

            // Priority 1: Category-specific override
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId)!;
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

            const routingItem: OrderItemForRouting = {
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
                routeMap.get(targetPrinter.printerId)!.items.push(routingItem);
            } else {
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
    async getRoutingConfiguration(tenantId: number) {
        const [categories, areas, printers] = await Promise.all([
            prisma.category.findMany({
                where: { tenantId },
                include: { printer: true },
                orderBy: { name: 'asc' }
            }),
            prisma.area.findMany({
                where: { tenantId },
                include: {
                    printerOverrides: {
                        include: { printer: true, category: true }
                    }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.printer.findMany({
                where: { tenantId },
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
    async setCategoryPrinter(tenantId: number, categoryId: number, printerId: number | null) {
        // Verify ownership
        const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
        if (!category) throw new Error('Category not found');

        // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
        return prisma.category.updateMany({
            where: { id: categoryId, tenantId },
            data: { printerId }
        });
    }

    /**
     * Set area printer override.
     * If categoryId is null, sets an area-wide override (all categories).
     */
    async setAreaOverride(tenantId: number, areaId: number, categoryId: number | null, printerId: number) {
        // Verify ownership of area
        const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
        if (!area) throw new Error('Area not found');

        // Prisma doesn't generate compound unique for nullable fields correctly
        // Use upsert with where clause that handles null
        const existing = await prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId, tenantId }
        });

        if (existing) {
            // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
            return prisma.areaPrinterOverride.updateMany({
                where: { id: existing.id, tenantId },
                data: { printerId }
            });
        } else {
            return prisma.areaPrinterOverride.create({
                data: { tenantId, areaId, categoryId, printerId }
            });
        }
    }

    /**
     * Remove area printer override.
     */
    async removeAreaOverride(tenantId: number, areaId: number, categoryId: number | null) {
        // Verify ownership
        const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
        if (!area) throw new Error('Area not found');

        // Find and delete since compound unique with nullable doesn't work directly
        const existing = await prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId, tenantId }
        });

        if (existing) {
            // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
            return prisma.areaPrinterOverride.deleteMany({
                where: { id: existing.id, tenantId }
            });
        }
        return null;
    }

    /**
     * Set area-wide override (all categories go to one printer).
     */
    async setAreaWideOverride(tenantId: number, areaId: number, printerId: number) {
        return this.setAreaOverride(tenantId, areaId, null, printerId);
    }

    /**
     * Remove area-wide override.
     */
    async removeAreaWideOverride(tenantId: number, areaId: number) {
        return this.removeAreaOverride(tenantId, areaId, null);
    }
}

export const printRoutingService = new PrintRoutingService();
