"use strict";
/**
 * Bulk Price Update Routes
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
const bulkPriceController = __importStar(require("../controllers/bulkPriceUpdate.controller"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get products for price grid
router.get('/products', (0, auth_1.requirePermission)('products', 'browse'), bulkPriceController.getProductsForGrid);
// Get categories for dropdown
router.get('/categories', (0, auth_1.requirePermission)('products', 'browse'), bulkPriceController.getCategories);
// Preview price changes
router.post('/preview', (0, auth_1.requirePermission)('products', 'update'), bulkPriceController.previewChanges);
// Apply bulk updates (requires admin-level permission)
router.post('/apply', (0, auth_1.requirePermission)('products', 'update'), bulkPriceController.applyUpdates);
// Update entire category
router.post('/category/:categoryId', (0, auth_1.requirePermission)('products', 'update'), bulkPriceController.updateByCategory);
exports.default = router;
//# sourceMappingURL=bulkPriceUpdate.routes.js.map