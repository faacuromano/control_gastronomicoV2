"use strict";
/**
 * @fileoverview Tipos Normalizados para Integraciones de Delivery
 *
 * Define estructuras de datos comunes que todas las plataformas
 * (Rappi, Glovo, PedidosYa) mapean a un formato interno unificado.
 *
 * RATIONALE:
 * Cada plataforma tiene su propio schema de pedidos. Este módulo
 * normaliza todos a un formato común para que el resto del sistema
 * solo trabaje con un tipo de dato.
 *
 * @module integrations/delivery/types/normalized
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventType = exports.NormalizedOrderStatus = exports.DeliveryPlatformCode = void 0;
// ============================================================================
// ENUMS
// ============================================================================
/**
 * Plataformas de delivery soportadas.
 */
var DeliveryPlatformCode;
(function (DeliveryPlatformCode) {
    DeliveryPlatformCode["RAPPI"] = "RAPPI";
    DeliveryPlatformCode["GLOVO"] = "GLOVO";
    DeliveryPlatformCode["PEDIDOSYA"] = "PEDIDOSYA";
    DeliveryPlatformCode["UBEREATS"] = "UBEREATS";
})(DeliveryPlatformCode || (exports.DeliveryPlatformCode = DeliveryPlatformCode = {}));
/**
 * Estados de pedido normalizados.
 * Mapean a los estados internos de OrderStatus.
 */
var NormalizedOrderStatus;
(function (NormalizedOrderStatus) {
    NormalizedOrderStatus["NEW"] = "NEW";
    NormalizedOrderStatus["ACCEPTED"] = "ACCEPTED";
    NormalizedOrderStatus["IN_PREPARATION"] = "IN_PREPARATION";
    NormalizedOrderStatus["READY"] = "READY";
    NormalizedOrderStatus["PICKED_UP"] = "PICKED_UP";
    NormalizedOrderStatus["ON_ROUTE"] = "ON_ROUTE";
    NormalizedOrderStatus["DELIVERED"] = "DELIVERED";
    NormalizedOrderStatus["CANCELLED"] = "CANCELLED";
    NormalizedOrderStatus["REJECTED"] = "REJECTED";
})(NormalizedOrderStatus || (exports.NormalizedOrderStatus = NormalizedOrderStatus = {}));
/**
 * Tipos de evento de webhook.
 */
var WebhookEventType;
(function (WebhookEventType) {
    WebhookEventType["ORDER_NEW"] = "ORDER_NEW";
    WebhookEventType["ORDER_CANCELLED"] = "ORDER_CANCELLED";
    WebhookEventType["ORDER_MODIFIED"] = "ORDER_MODIFIED";
    WebhookEventType["STATUS_UPDATE"] = "STATUS_UPDATE";
    WebhookEventType["DRIVER_ASSIGNED"] = "DRIVER_ASSIGNED";
    WebhookEventType["DRIVER_ARRIVED"] = "DRIVER_ARRIVED";
})(WebhookEventType || (exports.WebhookEventType = WebhookEventType = {}));
//# sourceMappingURL=normalized.types.js.map