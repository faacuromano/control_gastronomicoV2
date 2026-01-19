/**
 * @fileoverview PedidosYa Adapter Implementation
 *
 * Implementación concreta del adapter para la plataforma PedidosYa.
 *
 * DOCUMENTACIÓN PEDIDOSYA:
 * - API: Partner API (https://developers.pedidosya.com)
 * - Auth: OAuth 2.0 Client Credentials Flow
 * - Webhooks: HMAC-SHA256 en header X-PeYa-Signature
 * - Eventos: ORDER_DISPATCH (nuevo pedido), ORDER_STATUS_UPDATE
 *
 * @module integrations/delivery/adapters/PedidosYaAdapter
 */
import { AbstractDeliveryAdapter, type AdapterConfig } from './AbstractDeliveryAdapter';
import type { DeliveryPlatform } from '@prisma/client';
import { DeliveryPlatformCode, NormalizedOrderStatus, ProcessedWebhook, MenuSyncResult, AvailabilityUpdate, StatusUpdateResult } from '../types/normalized.types';
export declare class PedidosYaAdapter extends AbstractDeliveryAdapter {
    private httpClient;
    private accessToken;
    private tokenExpiry;
    constructor(platform: DeliveryPlatform, config?: Partial<AdapterConfig>);
    protected get platformCode(): DeliveryPlatformCode;
    protected getDefaultBaseUrl(): string;
    /**
     * Valida la firma HMAC del webhook de PedidosYa.
     * PedidosYa usa HMAC-SHA256 con el body raw.
     * Header: X-PeYa-Signature
     */
    validateWebhookSignature(signature: string, rawBody: Buffer): boolean;
    /**
     * Parsea el payload del webhook de PedidosYa al formato normalizado.
     */
    parseWebhookPayload(rawPayload: unknown): ProcessedWebhook;
    /**
     * Acepta un pedido en PedidosYa.
     */
    acceptOrder(externalOrderId: string, estimatedPrepTime: number): Promise<void>;
    /**
     * Rechaza un pedido en PedidosYa.
     */
    rejectOrder(externalOrderId: string, reason: string): Promise<void>;
    /**
     * Marca el pedido como listo para recoger.
     */
    markReady(externalOrderId: string): Promise<void>;
    /**
     * Actualiza el estado del pedido en PedidosYa.
     */
    updateOrderStatus(externalOrderId: string, status: NormalizedOrderStatus): Promise<StatusUpdateResult>;
    /**
     * Envía el menú a PedidosYa.
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
     * Actualiza disponibilidad de un producto en PedidosYa.
     */
    updateProductAvailability(update: AvailabilityUpdate): Promise<void>;
    /**
     * Asegura que tenemos un token válido para la API.
     */
    private ensureValidToken;
    /**
     * Obtiene un nuevo access token usando client credentials.
     */
    private refreshAccessToken;
    private determineEventType;
    private normalizeOrder;
    private normalizeCustomer;
    private normalizeAddress;
    private normalizeItem;
    private groupProductsByCategory;
}
//# sourceMappingURL=PedidosYaAdapter.d.ts.map