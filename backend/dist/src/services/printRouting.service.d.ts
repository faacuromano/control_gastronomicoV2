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
    unrouted: OrderItemForRouting[];
}
export declare class PrintRoutingService {
    /**
     * Get print routing for an order.
     * Groups order items by destination printer.
     *
     * @param orderId - Order ID to route
     * @returns RoutingResult with routes and unrouted items
     */
    getRoutingForOrder(orderId: number): Promise<RoutingResult>;
    /**
     * Get routing for specific items (for partial prints like "add items").
     *
     * @param items - Items to route
     * @param areaId - Optional area ID for override lookup
     */
    getRoutingForItems(items: Array<{
        productId: number;
        quantity: number;
        notes?: string;
    }>, areaId?: number): Promise<RoutingResult>;
    /**
     * Get all printers configured for routing (for admin UI).
     */
    getRoutingConfiguration(): Promise<{
        categories: {
            id: number;
            name: string;
            printerId: number | null;
            printerName: string | null;
        }[];
        areas: {
            id: number;
            name: string;
            overrides: {
                id: number;
                categoryId: number | null;
                categoryName: string;
                printerId: number;
                printerName: string;
            }[];
        }[];
        printers: {
            id: number;
            name: string;
            connectionType: import(".prisma/client").$Enums.PrinterConnection;
        }[];
    }>;
    /**
     * Set category default printer.
     */
    setCategoryPrinter(categoryId: number, printerId: number | null): Promise<{
        name: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number | null;
    }>;
    /**
     * Set area printer override.
     * If categoryId is null, sets an area-wide override (all categories).
     */
    setAreaOverride(areaId: number, categoryId: number | null, printerId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number;
        categoryId: number | null;
        areaId: number;
    }>;
    /**
     * Remove area printer override.
     */
    removeAreaOverride(areaId: number, categoryId: number | null): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number;
        categoryId: number | null;
        areaId: number;
    } | null>;
    /**
     * Set area-wide override (all categories go to one printer).
     */
    setAreaWideOverride(areaId: number, printerId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number;
        categoryId: number | null;
        areaId: number;
    }>;
    /**
     * Remove area-wide override.
     */
    removeAreaWideOverride(areaId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        printerId: number;
        categoryId: number | null;
        areaId: number;
    } | null>;
}
export declare const printRoutingService: PrintRoutingService;
export {};
//# sourceMappingURL=printRouting.service.d.ts.map