"use strict";
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
const categoryController = __importStar(require("../controllers/category.controller"));
const productController = __importStar(require("../controllers/product.controller"));
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Categories
// GET - Read access for anyone with products:read (for POS)
router.get('/categories', (0, auth_1.requirePermission)('products', 'read'), categoryController.listCategories);
router.get('/categories/:id', (0, auth_1.requirePermission)('products', 'read'), categoryController.getCategory);
// CUD - Admin operations require products:create/update/delete
router.post('/categories', (0, auth_1.requirePermission)('products', 'create'), categoryController.createCategory);
router.put('/categories/:id', (0, auth_1.requirePermission)('products', 'update'), categoryController.updateCategory);
router.delete('/categories/:id', (0, auth_1.requirePermission)('products', 'delete'), categoryController.deleteCategory);
// Products
// GET - Read access for anyone with products:read (for POS)
router.get('/products', (0, auth_1.requirePermission)('products', 'read'), productController.listProducts);
router.get('/products/:id', (0, auth_1.requirePermission)('products', 'read'), productController.getProduct);
// CUD - Admin operations require products:create/update/delete
router.post('/products', (0, auth_1.requirePermission)('products', 'create'), productController.createProduct);
router.put('/products/:id', (0, auth_1.requirePermission)('products', 'update'), productController.updateProduct);
router.delete('/products/:id', (0, auth_1.requirePermission)('products', 'delete'), productController.deleteProduct);
router.patch('/products/:id/toggle', (0, auth_1.requirePermission)('products', 'update'), productController.toggleActive);
exports.default = router;
//# sourceMappingURL=menu.routes.js.map