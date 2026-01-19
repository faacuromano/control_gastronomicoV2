"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RappiAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const AbstractDeliveryAdapter_1 = require("./AbstractDeliveryAdapter");
const normalized_types_1 = require("../types/normalized.types");
/**
 * Mapeo de estados de Rappi → Estados normalizados
 */
const RAPPI_STATUS_MAP = {
    'NEW': normalized_types_1.NormalizedOrderStatus.NEW,
    'ACCEPTED': normalized_types_1.NormalizedOrderStatus.ACCEPTED,
    'IN_STORE': normalized_types_1.NormalizedOrderStatus.IN_PREPARATION,
    'READY_FOR_PICKUP': normalized_types_1.NormalizedOrderStatus.READY,
    'PICKED_UP': normalized_types_1.NormalizedOrderStatus.PICKED_UP,
    'ON_THE_WAY': normalized_types_1.NormalizedOrderStatus.ON_ROUTE,
    'DELIVERED': normalized_types_1.NormalizedOrderStatus.DELIVERED,
    'CANCELLED': normalized_types_1.NormalizedOrderStatus.CANCELLED,
    'REJECTED': normalized_types_1.NormalizedOrderStatus.REJECTED,
};
/**
 * Mapeo inverso: Estados normalizados → Estados de Rappi
 */
const NORMALIZED_TO_RAPPI_STATUS = {
    [normalized_types_1.NormalizedOrderStatus.NEW]: 'NEW',
    [normalized_types_1.NormalizedOrderStatus.ACCEPTED]: 'ACCEPTED',
    [normalized_types_1.NormalizedOrderStatus.IN_PREPARATION]: 'IN_STORE',
    [normalized_types_1.NormalizedOrderStatus.READY]: 'READY_FOR_PICKUP',
    [normalized_types_1.NormalizedOrderStatus.PICKED_UP]: 'PICKED_UP',
    [normalized_types_1.NormalizedOrderStatus.ON_ROUTE]: 'ON_THE_WAY',
    [normalized_types_1.NormalizedOrderStatus.DELIVERED]: 'DELIVERED',
    [normalized_types_1.NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
    [normalized_types_1.NormalizedOrderStatus.REJECTED]: 'REJECTED',
};
// ============================================================================
// RAPPI ADAPTER
// ============================================================================
class RappiAdapter extends AbstractDeliveryAdapter_1.AbstractDeliveryAdapter {
    httpClient;
    constructor(platform, config = {}) {
        super(platform, config);
        this.httpClient = axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
                'X-Store-Id': this.config.storeId,
            },
        });
        // Log de requests para debugging
        this.httpClient.interceptors.request.use((config) => {
            this.log('debug', 'Outgoing request to Rappi', {
                method: config.method,
                url: config.url,
            });
            return config;
        });
    }
    // ============================================================================
    // IMPLEMENTACIÓN DE MÉTODOS ABSTRACTOS
    // ============================================================================
    get platformCode() {
        return normalized_types_1.DeliveryPlatformCode.RAPPI;
    }
    getDefaultBaseUrl() {
        // Argentina endpoint
        return process.env.RAPPI_API_URL || 'https://services.rappi.com.ar/api/v1';
    }
    /**
     * Valida la firma HMAC del webhook de Rappi.
     * Rappi usa HMAC-SHA256 con el body raw.
     */
    validateWebhookSignature(signature, rawBody) {
        if (!this.config.webhookSecret) {
            this.log('error', 'Cannot validate signature: webhookSecret not configured');
            return false;
        }
        const expectedSignature = this.computeHmac(rawBody, this.config.webhookSecret, 'sha256');
        const isValid = this.timingSafeEqual(signature, expectedSignature);
        if (!isValid) {
            this.log('warn', 'Webhook signature validation failed', {
                receivedLength: signature.length,
                expectedLength: expectedSignature.length,
            });
        }
        return isValid;
    }
    /**
     * Parsea el payload del webhook de Rappi al formato normalizado.
     */
    parseWebhookPayload(rawPayload) {
        const payload = rawPayload;
        // Determinar tipo de evento
        const eventType = this.determineEventType(payload);
        // Convertir a formato normalizado
        const order = this.normalizeOrder(payload);
        return {
            eventType,
            platform: normalized_types_1.DeliveryPlatformCode.RAPPI,
            externalOrderId: payload.order_id,
            order,
            receivedAt: new Date(),
            rawPayload,
        };
    }
    /**
     * Acepta un pedido en Rappi.
     */
    async acceptOrder(externalOrderId, estimatedPrepTime) {
        try {
            await this.httpClient.post(`/orders/${externalOrderId}/accept`, {
                estimated_time_minutes: estimatedPrepTime,
            });
            this.log('info', 'Order accepted in Rappi', { externalOrderId, estimatedPrepTime });
        }
        catch (error) {
            this.log('error', 'Failed to accept order in Rappi', {
                externalOrderId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Rechaza un pedido en Rappi.
     */
    async rejectOrder(externalOrderId, reason) {
        try {
            await this.httpClient.post(`/orders/${externalOrderId}/reject`, {
                reason,
            });
            this.log('info', 'Order rejected in Rappi', { externalOrderId, reason });
        }
        catch (error) {
            this.log('error', 'Failed to reject order in Rappi', {
                externalOrderId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Actualiza el estado del pedido en Rappi.
     */
    async updateOrderStatus(externalOrderId, status) {
        const rappiStatus = NORMALIZED_TO_RAPPI_STATUS[status];
        if (!rappiStatus) {
            return {
                success: false,
                externalId: externalOrderId,
                newStatus: status,
                error: `Unknown status mapping for: ${status}`,
            };
        }
        try {
            await this.httpClient.patch(`/orders/${externalOrderId}/status`, {
                status: rappiStatus,
            });
            this.log('info', 'Order status updated in Rappi', { externalOrderId, status: rappiStatus });
            return {
                success: true,
                externalId: externalOrderId,
                newStatus: status,
            };
        }
        catch (error) {
            return {
                success: false,
                externalId: externalOrderId,
                newStatus: status,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Envía el menú a Rappi.
     */
    async pushMenu(products) {
        const errors = [];
        let syncedProducts = 0;
        // Rappi espera el menú en un formato específico
        const rappiMenu = {
            categories: this.groupProductsByCategory(products),
            updated_at: new Date().toISOString(),
        };
        try {
            await this.httpClient.put(`/stores/${this.config.storeId}/menu`, rappiMenu);
            syncedProducts = products.length;
            this.log('info', 'Menu synced to Rappi', { productCount: syncedProducts });
        }
        catch (error) {
            this.log('error', 'Failed to sync menu to Rappi', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Marcar todos como fallidos
            products.forEach((p) => {
                errors.push({ productId: p.productId, error: 'Menu sync failed' });
            });
        }
        return {
            success: errors.length === 0,
            syncedProducts,
            failedProducts: errors.length,
            errors,
            syncedAt: new Date(),
        };
    }
    /**
     * Actualiza disponibilidad de un producto en Rappi.
     */
    async updateProductAvailability(update) {
        try {
            await this.httpClient.patch(`/stores/${this.config.storeId}/products/${update.externalSku}/availability`, { is_available: update.isAvailable });
            this.log('info', 'Product availability updated in Rappi', {
                externalSku: update.externalSku,
                isAvailable: update.isAvailable,
            });
        }
        catch (error) {
            this.log('error', 'Failed to update product availability in Rappi', {
                externalSku: update.externalSku,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    // ============================================================================
    // MÉTODOS PRIVADOS DE NORMALIZACIÓN
    // ============================================================================
    determineEventType(payload) {
        const status = payload.status?.toUpperCase();
        if (status === 'NEW')
            return normalized_types_1.WebhookEventType.ORDER_NEW;
        if (status === 'CANCELLED')
            return normalized_types_1.WebhookEventType.ORDER_CANCELLED;
        return normalized_types_1.WebhookEventType.STATUS_UPDATE;
    }
    normalizeOrder(payload) {
        return {
            externalId: payload.order_id,
            platform: normalized_types_1.DeliveryPlatformCode.RAPPI,
            displayNumber: payload.order_number,
            status: RAPPI_STATUS_MAP[payload.status?.toUpperCase()] || normalized_types_1.NormalizedOrderStatus.NEW,
            createdAt: new Date(payload.created_at),
            fulfillmentType: 'PLATFORM_DELIVERY',
            customer: this.normalizeCustomer(payload.customer),
            deliveryAddress: payload.delivery_address
                ? this.normalizeAddress(payload.delivery_address)
                : undefined,
            items: payload.items.map((item) => this.normalizeItem(item)),
            subtotal: payload.totals.subtotal,
            deliveryFee: payload.totals.delivery_fee,
            discount: payload.totals.discount,
            tip: payload.totals.tip,
            total: payload.totals.total,
            estimatedDeliveryAt: payload.estimated_delivery_time
                ? new Date(payload.estimated_delivery_time)
                : undefined,
            notes: payload.notes,
            paymentMethod: payload.payment.method,
            isPrepaid: payload.payment.is_prepaid,
            rawPayload: payload,
        };
    }
    normalizeCustomer(customer) {
        return {
            externalId: customer.id,
            name: `${customer.first_name} ${customer.last_name}`.trim(),
            phone: customer.phone,
            email: customer.email,
        };
    }
    normalizeAddress(address) {
        return {
            fullAddress: [address.address, address.address_two, address.city]
                .filter(Boolean)
                .join(', '),
            street: address.address,
            city: address.city,
            latitude: address.latitude,
            longitude: address.longitude,
            instructions: address.instructions,
        };
    }
    normalizeItem(item) {
        return {
            externalSku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            notes: item.comments,
            modifiers: (item.toppings || []).map((t) => ({
                externalSku: t.sku,
                name: t.name,
                price: t.price,
                quantity: t.quantity,
            })),
            removedIngredients: [], // Rappi manda esto en comments normalmente
        };
    }
    groupProductsByCategory(products) {
        const categoryMap = new Map();
        for (const product of products) {
            const existing = categoryMap.get(product.categoryName) || [];
            existing.push({
                sku: product.externalSku,
                name: product.name,
                description: product.description,
                price: product.price,
                is_available: product.isAvailable,
                image_url: product.imageUrl,
            });
            categoryMap.set(product.categoryName, existing);
        }
        return Array.from(categoryMap.entries()).map(([name, prods]) => ({
            name,
            products: prods,
        }));
    }
}
exports.RappiAdapter = RappiAdapter;
//# sourceMappingURL=RappiAdapter.js.map