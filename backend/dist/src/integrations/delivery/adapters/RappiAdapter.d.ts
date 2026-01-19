/**
 * @fileoverview Rappi Adapter Implementation
 *
 * Implementación concreta del adapter para la plataforma Rappi.
 *
 * DOCUMENTACIÓN RAPPI:
 * - Webhooks: Firma HMAC-SHA256 en header X-Rappi-Signature
 * - Timeout: 4 minutos para aceptar/rechazar
 * - API Base: https://services.rappi.com.ar/api/v1
 *
 * @module integrations/delivery/adapters/RappiAdapter
 */
import { AbstractDeliveryAdapter, type AdapterConfig } from './AbstractDeliveryAdapter';
import type { DeliveryPlatform } from '@prisma/client';
import { DeliveryPlatformCode, NormalizedOrderStatus, ProcessedWebhook, MenuSyncResult, AvailabilityUpdate, StatusUpdateResult } from '../types/normalized.types';
export declare class RappiAdapter extends AbstractDeliveryAdapter {
    private httpClient;
    constructor(platform: DeliveryPlatform, config?: Partial<AdapterConfig>);
    protected get platformCode(): DeliveryPlatformCode;
    protected getDefaultBaseUrl(): string;
    /**
     * Valida la firma HMAC del webhook de Rappi.
     * Rappi usa HMAC-SHA256 con el body raw.
     */
    validateWebhookSignature(signature: string, rawBody: Buffer): boolean;
    /**
     * Parsea el payload del webhook de Rappi al formato normalizado.
     */
    parseWebhookPayload(rawPayload: unknown): ProcessedWebhook;
    /**
     * Acepta un pedido en Rappi.
     */
    acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void>;
    /**
     * Rechaza un pedido en Rappi.
     */
    rejectOrder(externalOrderId: string, reason: string): Promise<void>;
    /**
     * Actualiza el estado del pedido en Rappi.
     */
    updateOrderStatus(externalOrderId: string, status: NormalizedOrderStatus): Promise<StatusUpdateResult>;
    /**
     * Envía el menú a Rappi.
     */
    pushMenu(products: Array<{
        productId: number;
        externalSku: string;
        name: string;
        description: string;
        price: number;
        categoryName: string;
        isAvailable: boolean;
        imageUrl?: string;
    }>): Promise<MenuSyncResult>;
    /**
     * Actualiza disponibilidad de un producto en Rappi.
     */
    updateProductAvailability(update: AvailabilityUpdate): Promise<void>;
    private determineEventType;
    private normalizeOrder;
    private normalizeCustomer;
    private normalizeAddress;
    private normalizeItem;
    private groupProductsByCategory;
}
//# sourceMappingURL=RappiAdapter.d.ts.map