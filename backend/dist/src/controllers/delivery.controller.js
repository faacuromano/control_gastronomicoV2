"use strict";
/**
 * @fileoverview Delivery Controller
 * Handles HTTP requests for delivery platforms and drivers
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignUserDriverToOrder = exports.getDeliveryOrders = exports.deleteDriver = exports.releaseDriver = exports.assignDriverToOrder = exports.toggleDriverActive = exports.toggleDriverAvailability = exports.updateDriver = exports.createDriver = exports.getDriverById = exports.getAvailableDrivers = exports.getAllDrivers = exports.deletePlatform = exports.togglePlatform = exports.updatePlatform = exports.createPlatform = exports.getPlatformById = exports.getAllPlatforms = void 0;
const delivery_service_1 = require("../services/delivery.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const response_1 = require("../utils/response");
// ============================================================================
// PLATFORMS
// ============================================================================
exports.getAllPlatforms = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const platforms = await delivery_service_1.deliveryService.getAllPlatforms();
    (0, response_1.sendSuccess)(res, platforms);
});
exports.getPlatformById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const platform = await delivery_service_1.deliveryService.getPlatformById(id);
    (0, response_1.sendSuccess)(res, platform);
});
exports.createPlatform = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const platform = await delivery_service_1.deliveryService.createPlatform(req.body);
    (0, response_1.sendSuccess)(res, platform, undefined, 201);
});
exports.updatePlatform = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const platform = await delivery_service_1.deliveryService.updatePlatform(id, req.body);
    (0, response_1.sendSuccess)(res, platform);
});
exports.togglePlatform = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const platform = await delivery_service_1.deliveryService.togglePlatform(id);
    (0, response_1.sendSuccess)(res, platform);
});
exports.deletePlatform = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await delivery_service_1.deliveryService.deletePlatform(id);
    (0, response_1.sendSuccess)(res, { message: 'Platform deleted' });
});
// ============================================================================
// DRIVERS
// ============================================================================
exports.getAllDrivers = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const drivers = await delivery_service_1.deliveryService.getAllDrivers();
    (0, response_1.sendSuccess)(res, drivers);
});
exports.getAvailableDrivers = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const drivers = await delivery_service_1.deliveryService.getAvailableDrivers();
    (0, response_1.sendSuccess)(res, drivers);
});
exports.getDriverById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await delivery_service_1.deliveryService.getDriverById(id);
    (0, response_1.sendSuccess)(res, driver);
});
exports.createDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const driver = await delivery_service_1.deliveryService.createDriver(req.body);
    (0, response_1.sendSuccess)(res, driver, undefined, 201);
});
exports.updateDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await delivery_service_1.deliveryService.updateDriver(id, req.body);
    (0, response_1.sendSuccess)(res, driver);
});
exports.toggleDriverAvailability = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await delivery_service_1.deliveryService.toggleDriverAvailability(id);
    (0, response_1.sendSuccess)(res, driver);
});
exports.toggleDriverActive = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await delivery_service_1.deliveryService.toggleDriverActive(id);
    (0, response_1.sendSuccess)(res, driver);
});
exports.assignDriverToOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const driverId = parseInt(req.params.id);
    const { orderId } = req.body;
    await delivery_service_1.deliveryService.assignDriverToOrder(driverId, orderId);
    (0, response_1.sendSuccess)(res, { message: 'Driver assigned to order' });
});
exports.releaseDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await delivery_service_1.deliveryService.releaseDriver(id);
    (0, response_1.sendSuccess)(res, driver);
});
exports.deleteDriver = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await delivery_service_1.deliveryService.deleteDriver(id);
    (0, response_1.sendSuccess)(res, { message: 'Driver deleted' });
});
// ============================================================================
// DELIVERY ORDERS
// ============================================================================
exports.getDeliveryOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const status = req.query.status;
    const orders = await delivery_service_1.deliveryService.getDeliveryOrders(status);
    (0, response_1.sendSuccess)(res, orders);
});
/**
 * Assign a User (with delivery role) as driver to an order.
 * This uses the driverId field (FK to User), not deliveryDriverId.
 */
exports.assignUserDriverToOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { driverId } = req.body;
    // Import orderDeliveryService for User driver assignment
    const { orderDeliveryService } = await Promise.resolve().then(() => __importStar(require('../services/orderDelivery.service')));
    const order = await orderDeliveryService.assignDriver(orderId, driverId);
    (0, response_1.sendSuccess)(res, order);
});
//# sourceMappingURL=delivery.controller.js.map