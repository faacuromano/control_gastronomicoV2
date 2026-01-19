"use strict";
/**
 * @fileoverview Delivery Routes
 * Routes for managing delivery platforms and drivers
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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const deliveryController = __importStar(require("../controllers/delivery.controller"));
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================================================
// PLATFORMS
// ============================================================================
router.get('/platforms', deliveryController.getAllPlatforms);
router.get('/platforms/:id', deliveryController.getPlatformById);
router.post('/platforms', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.createPlatform);
router.patch('/platforms/:id', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.updatePlatform);
router.patch('/platforms/:id/toggle', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.togglePlatform);
router.delete('/platforms/:id', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.deletePlatform);
// ============================================================================
// DRIVERS
// ============================================================================
router.get('/drivers', deliveryController.getAllDrivers);
router.get('/drivers/available', deliveryController.getAvailableDrivers);
router.get('/drivers/:id', deliveryController.getDriverById);
router.post('/drivers', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.createDriver);
router.patch('/drivers/:id', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.updateDriver);
router.patch('/drivers/:id/availability', deliveryController.toggleDriverAvailability);
router.patch('/drivers/:id/active', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.toggleDriverActive);
router.post('/drivers/:id/assign', deliveryController.assignDriverToOrder);
router.post('/drivers/:id/release', deliveryController.releaseDriver);
router.delete('/drivers/:id', (0, auth_1.requirePermission)('settings', 'update'), deliveryController.deleteDriver);
// ============================================================================
// DELIVERY ORDERS
// ============================================================================
router.get('/orders', deliveryController.getDeliveryOrders);
// Assign User (with delivery role) as driver to an order
router.patch('/orders/:orderId/assign', deliveryController.assignUserDriverToOrder);
exports.default = router;
//# sourceMappingURL=delivery.routes.js.map