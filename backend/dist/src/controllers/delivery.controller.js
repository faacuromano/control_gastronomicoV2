"use strict";
/**
 * @fileoverview Delivery Controller
 * Handles HTTP requests for delivery platforms and drivers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeliveryOrders = exports.deleteDriver = exports.releaseDriver = exports.assignDriverToOrder = exports.toggleDriverActive = exports.toggleDriverAvailability = exports.updateDriver = exports.createDriver = exports.getDriverById = exports.getAvailableDrivers = exports.getAllDrivers = exports.deletePlatform = exports.togglePlatform = exports.updatePlatform = exports.createPlatform = exports.getPlatformById = exports.getAllPlatforms = void 0;
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
//# sourceMappingURL=delivery.controller.js.map