/**
 * @fileoverview Menu Sync Service
 *
 * Servicio para sincronizar el menú del restaurante con plataformas de delivery.
 *
 * RESPONSABILIDADES:
 * 1. Obtener productos con precios de canal configurados
 * 2. Formatear menú según cada plataforma
 * 3. Enviar menú via adapter correspondiente
 * 4. Registrar resultado de sincronización
 *
 * @module integrations/delivery/sync/menuSync.service
 */
import type { MenuSyncResult } from '../types/normalized.types';
declare class MenuSyncService {
    /**
     * Sincroniza el menú con una plataforma específica.
     *
     * @param platformId - ID de la plataforma
     * @returns Resultado de la sincronización
     */
    syncToPlatform(platformId: number): Promise<MenuSyncResult>;
    /**
     * Sincroniza el menú con todas las plataformas activas.
     */
    syncToAllPlatforms(): Promise<Map<number, MenuSyncResult>>;
    /**
     * Encola una sincronización de menú para procesamiento asíncrono.
     */
    enqueueSync(platformId: number, triggeredBy?: 'MANUAL' | 'SCHEDULE' | 'PRODUCT_UPDATE'): Promise<string>;
    /**
     * Obtiene los productos formateados para una plataforma.
     */
    private getProductsForPlatform;
}
export declare const menuSyncService: MenuSyncService;
export {};
//# sourceMappingURL=menuSync.service.d.ts.map