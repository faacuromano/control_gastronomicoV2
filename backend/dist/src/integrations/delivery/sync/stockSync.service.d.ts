/**
 * @fileoverview Stock Sync Service
 *
 * Servicio para sincronizar disponibilidad de productos con plataformas de delivery.
 *
 * Cuando un producto se queda sin stock o se marca como no disponible,
 * este servicio notifica a todas las plataformas configuradas.
 *
 * @module integrations/delivery/sync/stockSync.service
 */
declare class StockSyncService {
    /**
     * Actualiza la disponibilidad de un producto en todas las plataformas.
     *
     * @param productId - ID del producto
     * @param isAvailable - Nuevo estado de disponibilidad
     */
    updateProductAvailability(productId: number, isAvailable: boolean): Promise<Map<number, boolean>>;
    /**
     * Marca un producto como fuera de stock en todas las plataformas.
     * Útil cuando se detecta falta de ingredientes.
     */
    markOutOfStock(productId: number, reason?: 'OUT_OF_STOCK' | 'INGREDIENT_SHORTAGE'): Promise<void>;
    /**
     * Restaura la disponibilidad de un producto.
     */
    markInStock(productId: number): Promise<void>;
    /**
     * Encola una actualización de stock para procesamiento asíncrono.
     * Útil para actualizaciones masivas.
     */
    enqueueStockUpdate(productId: number, isAvailable: boolean, reason?: 'OUT_OF_STOCK' | 'MANUAL' | 'INGREDIENT_SHORTAGE' | 'SCHEDULE'): Promise<string>;
    /**
     * Sincroniza disponibilidad de todos los productos con una plataforma.
     * Útil después de reconectar con una plataforma.
     */
    fullSyncToPlatform(platformId: number): Promise<number>;
}
export declare const stockSyncService: StockSyncService;
export {};
//# sourceMappingURL=stockSync.service.d.ts.map