"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidosYaAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const AbstractDeliveryAdapter_1 = require("./AbstractDeliveryAdapter");
const normalized_types_1 = require("../types/normalized.types");
/**
 * Mapeo de estados de PedidosYa → Estados normalizados
 */
const PEDIDOSYA_STATUS_MAP = {
    'PENDING': normalized_types_1.NormalizedOrderStatus.NEW,
    'CONFIRMED': normalized_types_1.NormalizedOrderStatus.ACCEPTED,
    'IN_PROGRESS': normalized_types_1.NormalizedOrderStatus.IN_PREPARATION,
    'READY': normalized_types_1.NormalizedOrderStatus.READY,
    'PICKED_UP': normalized_types_1.NormalizedOrderStatus.PICKED_UP,
    'DELIVERED': normalized_types_1.NormalizedOrderStatus.DELIVERED,
    'CANCELLED': normalized_types_1.NormalizedOrderStatus.CANCELLED,
    'REJECTED': normalized_types_1.NormalizedOrderStatus.REJECTED,
};
/**
 * Mapeo inverso: Estados normalizados → Estados de PedidosYa
 */
const NORMALIZED_TO_PEDIDOSYA_STATUS = {
    [normalized_types_1.NormalizedOrderStatus.NEW]: 'PENDING',
    [normalized_types_1.NormalizedOrderStatus.ACCEPTED]: 'CONFIRMED',
    [normalized_types_1.NormalizedOrderStatus.IN_PREPARATION]: 'IN_PROGRESS',
    [normalized_types_1.NormalizedOrderStatus.READY]: 'READY',
    [normalized_types_1.NormalizedOrderStatus.PICKED_UP]: 'PICKED_UP',
    [normalized_types_1.NormalizedOrderStatus.ON_ROUTE]: 'PICKED_UP', // PeYa doesn't have ON_ROUTE
    [normalized_types_1.NormalizedOrderStatus.DELIVERED]: 'DELIVERED',
    [normalized_types_1.NormalizedOrderStatus.CANCELLED]: 'CANCELLED',
    [normalized_types_1.NormalizedOrderStatus.REJECTED]: 'REJECTED',
};
// ============================================================================
// PEDIDOSYA ADAPTER
// ============================================================================
class PedidosYaAdapter extends AbstractDeliveryAdapter_1.AbstractDeliveryAdapter {
    httpClient;
    accessToken = null;
    tokenExpiry = null;
    constructor(platform, config = {}) {
        super(platform, config);
        this.httpClient = axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Interceptor para agregar token y refrescarlo si es necesario
        this.httpClient.interceptors.request.use(async (config) => {
            await this.ensureValidToken();
            config.headers.Authorization = `Bearer ${this.accessToken}`;
            this.log('debug', 'Outgoing request to PedidosYa', {
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
        return normalized_types_1.DeliveryPlatformCode.PEDIDOSYA;
    }
    getDefaultBaseUrl() {
        // Argentina endpoint
        return process.env.PEDIDOSYA_API_URL || 'https://api.pedidosya.com/v3';
    }
    /**
     * Valida la firma HMAC del webhook de PedidosYa.
     * PedidosYa usa HMAC-SHA256 con el body raw.
     * Header: X-PeYa-Signature
     */
    validateWebhookSignature(signature, rawBody) {
        if (!this.config.webhookSecret) {
            this.log('error', 'Cannot validate signature: webhookSecret not configured');
            return false;
        }
        // PedidosYa envía la firma como "sha256=xxxx"
        const signatureParts = signature.split('=');
        const actualSignature = signatureParts.length > 1 ? signatureParts[1] : signature;
        if (!actualSignature) {
            this.log('error', 'Invalid signature format');
            return false;
        }
        const expectedSignature = this.computeHmac(rawBody, this.config.webhookSecret, 'sha256');
        const isValid = this.timingSafeEqual(actualSignature, expectedSignature);
        if (!isValid) {
            this.log('warn', 'Webhook signature validation failed', {
                receivedLength: actualSignature.length,
                expectedLength: expectedSignature.length,
            });
        }
        return isValid;
    }
    /**
     * Parsea el payload del webhook de PedidosYa al formato normalizado.
     */
    parseWebhookPayload(rawPayload) {
        const webhookData = rawPayload;
        const payload = webhookData.order || rawPayload;
        // Determinar tipo de evento
        const eventType = this.determineEventType(webhookData);
        // Convertir a formato normalizado
        const order = this.normalizeOrder(payload);
        return {
            eventType,
            platform: normalized_types_1.DeliveryPlatformCode.PEDIDOSYA,
            externalOrderId: payload.id,
            order,
            receivedAt: new Date(),
            rawPayload,
        };
    }
    /**
     * Acepta un pedido en PedidosYa.
     */
    async acceptOrder(externalOrderId, estimatedPrepTime) {
        try {
            await this.httpClient.post(`/orders/${externalOrderId}/confirmation`, {
                state: 'CONFIRMED',
                cookingTime: estimatedPrepTime,
            });
            this.log('info', 'Order accepted in PedidosYa', { externalOrderId, estimatedPrepTime });
        }
        catch (error) {
            this.log('error', 'Failed to accept order in PedidosYa', {
                externalOrderId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Rechaza un pedido en PedidosYa.
     */
    async rejectOrder(externalOrderId, reason) {
        try {
            await this.httpClient.post(`/orders/${externalOrderId}/rejection`, {
                state: 'REJECTED',
                rejectMessage: reason,
            });
            this.log('info', 'Order rejected in PedidosYa', { externalOrderId, reason });
        }
        catch (error) {
            this.log('error', 'Failed to reject order in PedidosYa', {
                externalOrderId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Marca el pedido como listo para recoger.
     */
    async markReady(externalOrderId) {
        try {
            await this.httpClient.post(`/orders/${externalOrderId}/ready`, {
                state: 'READY',
            });
            this.log('info', 'Order marked ready in PedidosYa', { externalOrderId });
        }
        catch (error) {
            this.log('error', 'Failed to mark order ready in PedidosYa', {
                externalOrderId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Actualiza el estado del pedido en PedidosYa.
     */
    async updateOrderStatus(externalOrderId, status) {
        const peyaStatus = NORMALIZED_TO_PEDIDOSYA_STATUS[status];
        if (!peyaStatus) {
            return {
                success: false,
                externalId: externalOrderId,
                newStatus: status,
                error: `Unknown status mapping for: ${status}`,
            };
        }
        try {
            // PedidosYa usa diferentes endpoints según el estado
            if (status === normalized_types_1.NormalizedOrderStatus.READY) {
                await this.markReady(externalOrderId);
            }
            else {
                await this.httpClient.patch(`/orders/${externalOrderId}`, {
                    state: peyaStatus,
                });
            }
            this.log('info', 'Order status updated in PedidosYa', { externalOrderId, status: peyaStatus });
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
     * Envía el menú a PedidosYa.
     */
    async pushMenu(products) {
        const errors = [];
        let syncedProducts = 0;
        // PedidosYa espera el menú en un formato específico (categories -> sections -> products)
        const peyaMenu = {
            name: 'Menu',
            sections: this.groupProductsByCategory(products),
        };
        try {
            await this.httpClient.put(`/restaurants/${this.config.storeId}/menu`, peyaMenu);
            syncedProducts = products.length;
            this.log('info', 'Menu synced to PedidosYa', { productCount: syncedProducts });
        }
        catch (error) {
            this.log('error', 'Failed to sync menu to PedidosYa', {
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
     * Actualiza disponibilidad de un producto en PedidosYa.
     */
    async updateProductAvailability(update) {
        try {
            await this.httpClient.patch(`/restaurants/${this.config.storeId}/products/${update.externalSku}`, { enabled: update.isAvailable });
            this.log('info', 'Product availability updated in PedidosYa', {
                externalSku: update.externalSku,
                isAvailable: update.isAvailable,
            });
        }
        catch (error) {
            this.log('error', 'Failed to update product availability in PedidosYa', {
                externalSku: update.externalSku,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    // ============================================================================
    // OAUTH TOKEN MANAGEMENT
    // ============================================================================
    /**
     * Asegura que tenemos un token válido para la API.
     */
    async ensureValidToken() {
        // Si el token es válido y no ha expirado, no hacer nada
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return;
        }
        // Obtener nuevo token
        await this.refreshAccessToken();
    }
    /**
     * Obtiene un nuevo access token usando client credentials.
     */
    async refreshAccessToken() {
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: this.config.storeId, // Client ID = Store ID en PedidosYa
                client_secret: this.config.apiKey,
            }, {
                headers: { 'Content-Type': 'application/json' },
            });
            this.accessToken = response.data.access_token;
            // Expira en 1 hora menos 5 minutos de margen
            this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
            this.log('info', 'PedidosYa access token refreshed', {
                expiresIn: response.data.expires_in,
            });
        }
        catch (error) {
            this.log('error', 'Failed to refresh PedidosYa access token', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    // ============================================================================
    // MÉTODOS PRIVADOS DE NORMALIZACIÓN
    // ============================================================================
    determineEventType(webhookData) {
        const event = webhookData.event?.toUpperCase();
        if (event === 'ORDER_DISPATCH')
            return normalized_types_1.WebhookEventType.ORDER_NEW;
        if (event === 'ORDER_CANCEL')
            return normalized_types_1.WebhookEventType.ORDER_CANCELLED;
        if (event === 'ORDER_STATUS_UPDATE')
            return normalized_types_1.WebhookEventType.STATUS_UPDATE;
        // Fallback: determinar por estado del pedido
        const order = webhookData.order;
        if (order?.state?.toUpperCase() === 'PENDING')
            return normalized_types_1.WebhookEventType.ORDER_NEW;
        if (order?.state?.toUpperCase() === 'CANCELLED')
            return normalized_types_1.WebhookEventType.ORDER_CANCELLED;
        return normalized_types_1.WebhookEventType.STATUS_UPDATE;
    }
    normalizeOrder(payload) {
        const fulfillmentType = payload.pickup
            ? 'TAKEAWAY'
            : (payload.deliveryMethod === 'MERCHANT' ? 'SELF_DELIVERY' : 'PLATFORM_DELIVERY');
        return {
            externalId: payload.id,
            platform: normalized_types_1.DeliveryPlatformCode.PEDIDOSYA,
            displayNumber: payload.code,
            status: PEDIDOSYA_STATUS_MAP[payload.state?.toUpperCase()] || normalized_types_1.NormalizedOrderStatus.NEW,
            createdAt: new Date(payload.registeredDate),
            fulfillmentType,
            customer: this.normalizeCustomer(payload.user),
            deliveryAddress: payload.address && !payload.pickup
                ? this.normalizeAddress(payload.address)
                : undefined,
            items: payload.details.map((detail) => this.normalizeItem(detail)),
            subtotal: payload.payment.subtotal,
            deliveryFee: payload.payment.shipping,
            discount: payload.payment.discount,
            tip: payload.payment.tip,
            total: payload.payment.total,
            estimatedDeliveryAt: payload.deliveryDate
                ? new Date(payload.deliveryDate)
                : undefined,
            notes: payload.notes,
            paymentMethod: payload.payment.paymentMethod,
            isPrepaid: payload.payment.online || payload.payment.pending === 0,
            rawPayload: payload,
        };
    }
    normalizeCustomer(user) {
        return {
            externalId: user.id,
            name: `${user.name} ${user.lastName || ''}`.trim(),
            phone: user.phone,
            email: user.email,
        };
    }
    normalizeAddress(address) {
        const fullAddress = [
            address.description,
            address.doorNumber,
            address.area,
            address.city
        ].filter(Boolean).join(', ');
        return {
            fullAddress,
            street: address.description,
            city: address.city,
            zipCode: address.zipCode,
            latitude: address.coordinates?.latitude,
            longitude: address.coordinates?.longitude,
            instructions: address.notes,
        };
    }
    normalizeItem(detail) {
        // SKU: usar integrationCode si existe, sino usar ID del producto
        const externalSku = detail.product.integrationCode || detail.product.id;
        // Aplanar los modificadores de los optionGroups
        const modifiers = (detail.optionGroups || []).flatMap(group => group.options.map(opt => ({
            externalSku: opt.id,
            name: opt.name,
            price: opt.amount,
            quantity: opt.quantity,
        })));
        return {
            externalSku,
            name: detail.product.name,
            quantity: detail.quantity,
            unitPrice: detail.product.unitPrice,
            notes: detail.notes,
            modifiers,
            removedIngredients: [], // PedidosYa manda esto en notes normalmente
        };
    }
    groupProductsByCategory(products) {
        const categoryMap = new Map();
        for (const product of products) {
            const existing = categoryMap.get(product.categoryName) || [];
            existing.push({
                integrationCode: product.externalSku,
                name: product.name,
                description: product.description,
                price: product.price,
                enabled: product.isAvailable,
                image: product.imageUrl,
            });
            categoryMap.set(product.categoryName, existing);
        }
        return Array.from(categoryMap.entries()).map(([name, prods]) => ({
            name,
            products: prods,
        }));
    }
}
exports.PedidosYaAdapter = PedidosYaAdapter;
//# sourceMappingURL=PedidosYaAdapter.js.map