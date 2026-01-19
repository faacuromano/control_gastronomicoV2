"use strict";
/**
 * @fileoverview Print Routing Routes.
 * Routes for configuring print routing (Toast-style).
 *
 * @module routes/printRouting.routes
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
const printRoutingController = __importStar(require("../controllers/printRouting.controller"));
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get routing configuration (categories, areas, printers)
router.get('/config', (0, auth_1.requirePermission)('printers', 'browse'), printRoutingController.getConfiguration);
// Get routing preview for an order
router.get('/order/:orderId', (0, auth_1.requirePermission)('orders', 'browse'), printRoutingController.getOrderRouting);
// Set category default printer
router.patch('/category/:categoryId/printer', (0, auth_1.requirePermission)('printers', 'update'), printRoutingController.setCategoryPrinter);
// Set area printer override
router.post('/area/:areaId/override', (0, auth_1.requirePermission)('printers', 'update'), printRoutingController.setAreaOverride);
// Remove area printer override
router.delete('/area/:areaId/override', (0, auth_1.requirePermission)('printers', 'delete'), printRoutingController.removeAreaOverride);
exports.default = router;
//# sourceMappingURL=printRouting.routes.js.map