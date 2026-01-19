"use strict";
/**
 * @fileoverview Delivery Adapters Module Exports
 *
 * Punto de entrada para el sistema de adapters de delivery.
 *
 * @module integrations/delivery/adapters
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
exports.RappiAdapter = exports.AdapterFactory = exports.AbstractDeliveryAdapter = void 0;
// Abstract base
var AbstractDeliveryAdapter_1 = require("./AbstractDeliveryAdapter");
Object.defineProperty(exports, "AbstractDeliveryAdapter", { enumerable: true, get: function () { return AbstractDeliveryAdapter_1.AbstractDeliveryAdapter; } });
// Factory
var AdapterFactory_1 = require("./AdapterFactory");
Object.defineProperty(exports, "AdapterFactory", { enumerable: true, get: function () { return AdapterFactory_1.AdapterFactory; } });
Object.defineProperty(exports, "RappiAdapter", { enumerable: true, get: function () { return AdapterFactory_1.RappiAdapter; } });
// Re-export types
__exportStar(require("../types/normalized.types"), exports);
//# sourceMappingURL=index.js.map