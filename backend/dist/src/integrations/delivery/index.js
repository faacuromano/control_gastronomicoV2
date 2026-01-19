"use strict";
/**
 * @fileoverview Delivery Integration Module
 *
 * Punto de entrada principal para el sistema de integraciones de delivery.
 *
 * ESTRUCTURA:
 * - adapters/  → Adaptadores por plataforma (Rappi, Glovo, etc.)
 * - webhooks/  → Recepción y procesamiento de webhooks
 * - jobs/      → Workers para procesamiento asíncrono
 * - types/     → Tipos normalizados comunes
 *
 * @module integrations/delivery
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusUpdateService = exports.stockSyncService = exports.menuSyncService = exports.initWebhookProcessor = exports.skipHmacInDevelopment = exports.validateHmacDynamic = exports.validateHmac = exports.webhookRoutes = exports.webhookController = exports.RappiAdapter = exports.AdapterFactory = exports.AbstractDeliveryAdapter = void 0;
// Adapters
var adapters_1 = require("./adapters");
Object.defineProperty(exports, "AbstractDeliveryAdapter", { enumerable: true, get: function () { return adapters_1.AbstractDeliveryAdapter; } });
Object.defineProperty(exports, "AdapterFactory", { enumerable: true, get: function () { return adapters_1.AdapterFactory; } });
Object.defineProperty(exports, "RappiAdapter", { enumerable: true, get: function () { return adapters_1.RappiAdapter; } });
// Webhooks
var webhooks_1 = require("./webhooks");
Object.defineProperty(exports, "webhookController", { enumerable: true, get: function () { return webhooks_1.webhookController; } });
Object.defineProperty(exports, "webhookRoutes", { enumerable: true, get: function () { return webhooks_1.webhookRoutes; } });
Object.defineProperty(exports, "validateHmac", { enumerable: true, get: function () { return webhooks_1.validateHmac; } });
Object.defineProperty(exports, "validateHmacDynamic", { enumerable: true, get: function () { return webhooks_1.validateHmacDynamic; } });
Object.defineProperty(exports, "skipHmacInDevelopment", { enumerable: true, get: function () { return webhooks_1.skipHmacInDevelopment; } });
// Jobs
var jobs_1 = require("./jobs");
Object.defineProperty(exports, "initWebhookProcessor", { enumerable: true, get: function () { return jobs_1.initWebhookProcessor; } });
// Sync Services
var sync_1 = require("./sync");
Object.defineProperty(exports, "menuSyncService", { enumerable: true, get: function () { return sync_1.menuSyncService; } });
Object.defineProperty(exports, "stockSyncService", { enumerable: true, get: function () { return sync_1.stockSyncService; } });
Object.defineProperty(exports, "statusUpdateService", { enumerable: true, get: function () { return sync_1.statusUpdateService; } });
// Types
__exportStar(require("./types/normalized.types"), exports);
//# sourceMappingURL=index.js.map