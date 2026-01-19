/**
 * @fileoverview Margin Consent Service (Safety Lock Protocol)
 *
 * Implementa el protocolo de consentimiento de margen para plataformas de delivery.
 * El usuario DEBE aceptar explícitamente el riesgo de usar precios base antes de activar
 * fallback pricing en cualquier plataforma.
 *
 * RATIONALE:
 * - Rappi/Glovo cobran 20-30% de comisión
 * - Si el restaurante sube precios sin ajustar, pierde dinero en cada venta
 * - Este servicio actúa como "Safety Lock" legal para proteger al negocio
 *
 * @module services/marginConsent.service
 */
import type { DeliveryPlatform } from '@prisma/client';
/**
 * Input para aceptar consentimiento de margen.
 */
export interface MarginConsentInput {
    platformId: number;
    userId: number;
    explicitConsent: boolean;
    defaultMarkup?: number;
}
/**
 * Input para activar/desactivar una plataforma.
 */
export interface TogglePlatformInput {
    platformId: number;
    enable: boolean;
    useFallbackPricing?: boolean;
    consentToken?: string;
    userId: number;
}
/**
 * Resultado de la verificación del Safety Lock.
 */
export interface SafetyLockStatus {
    isLocked: boolean;
    requiresConsent: boolean;
    hasConsentRecord: boolean;
    consentDate?: Date | undefined;
    consentBy?: number | undefined;
    defaultMarkup?: number | undefined;
    message?: string | undefined;
}
declare class MarginConsentService {
    /**
     * Verifica el estado del Safety Lock para una plataforma.
     *
     * El Safety Lock está BLOQUEADO si:
     * 1. useFallbackPricing = true (quiere usar precios base)
     * 2. marginConsentAcceptedAt = null (no hay consentimiento)
     *
     * @returns Estado detallado del lock
     */
    getSafetyLockStatus(platformId: number): Promise<SafetyLockStatus>;
    /**
     * Registra el consentimiento explícito del usuario.
     *
     * REQUISITOS LEGALES:
     * - explicitConsent DEBE ser true (el usuario marcó el checkbox)
     * - Se registra timestamp y userId para auditoría
     *
     * @throws BadRequestError si explicitConsent !== true
     */
    acceptMarginConsent(input: MarginConsentInput): Promise<DeliveryPlatform>;
    /**
     * Revoca el consentimiento de margen.
     * Esto desactiva el fallback pricing automáticamente.
     */
    revokeMarginConsent(platformId: number): Promise<DeliveryPlatform>;
    /**
     * Activa o desactiva una plataforma con validación del Safety Lock.
     *
     * PROTOCOLO:
     * 1. Si enable=true Y useFallbackPricing=true → Requiere consentimiento previo
     * 2. Si no hay consentimiento → Lanzar 400 Bad Request
     * 3. El frontend debe mostrar "Modal de Muerte" antes de llamar
     *
     * @throws BadRequestError si el Safety Lock está bloqueado
     */
    togglePlatformWithSafetyCheck(input: TogglePlatformInput): Promise<DeliveryPlatform>;
    /**
     * Calcula el precio efectivo para un producto en una plataforma.
     *
     * ESTRATEGIA DE PRECIO (Smart Fallback):
     * 1. Si existe ProductChannelPrice → Usar ese precio específico
     * 2. Si NO existe Y useFallbackPricing = true → Precio base × (1 + defaultMarkup%)
     * 3. Si NO existe Y useFallbackPricing = false → Precio base (con advertencia)
     *
     * @returns Precio calculado con metadata de origen
     */
    getEffectivePrice(productId: number, platformId: number | null): Promise<{
        price: number;
        source: 'channel' | 'fallback' | 'base';
        markup?: number;
    }>;
}
export declare const marginConsentService: MarginConsentService;
export {};
//# sourceMappingURL=marginConsent.service.d.ts.map