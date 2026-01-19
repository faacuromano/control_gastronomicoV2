/**
 * @fileoverview Adapter Factory
 *
 * Factory para obtener el adapter correcto según la plataforma.
 * Implementa el patrón Factory Method para abstraer la creación de adapters.
 *
 * @module integrations/delivery/adapters/AdapterFactory
 */
import { AbstractDeliveryAdapter } from './AbstractDeliveryAdapter';
import { RappiAdapter } from './RappiAdapter';
declare class AdapterFactoryClass {
    /**
     * Obtiene un adapter por ID de plataforma.
     *
     * @param platformId - ID de la plataforma en la base de datos
     * @returns Adapter correspondiente
     * @throws NotFoundError si la plataforma no existe
     * @throws Error si no hay adapter implementado para esa plataforma
     */
    getByPlatformId(platformId: number): Promise<AbstractDeliveryAdapter>;
    /**
     * Obtiene un adapter por código de plataforma.
     *
     * @param code - Código de la plataforma (RAPPI, GLOVO, etc.)
     * @returns Adapter correspondiente
     */
    getByPlatformCode(code: string): Promise<AbstractDeliveryAdapter>;
    /**
     * Obtiene todos los adapters para plataformas activas.
     *
     * @returns Array de adapters activos
     */
    getActiveAdapters(): Promise<AbstractDeliveryAdapter[]>;
    /**
     * Verifica si existe un adapter para una plataforma.
     *
     * @param code - Código de la plataforma
     * @returns true si hay adapter implementado
     */
    hasAdapter(code: string): boolean;
    /**
     * Lista los códigos de plataformas con adaptadores disponibles.
     */
    getAvailablePlatformCodes(): string[];
    /**
     * Invalida el cache de un adapter específico.
     * Útil cuando se actualizan las credenciales de una plataforma.
     */
    invalidateCache(platformId: number): void;
    /**
     * Limpia todo el cache de adapters.
     */
    clearCache(): void;
    private createAdapter;
}
export declare const AdapterFactory: AdapterFactoryClass;
export { RappiAdapter };
//# sourceMappingURL=AdapterFactory.d.ts.map