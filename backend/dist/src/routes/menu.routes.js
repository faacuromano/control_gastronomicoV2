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
// Categories
router.get('/categories', auth_1.authenticateToken, categoryController.listCategories);
router.get('/categories/:id', auth_1.authenticateToken, categoryController.getCategory);
router.post('/categories', auth_1.authenticateToken, categoryController.createCategory);
router.put('/categories/:id', auth_1.authenticateToken, categoryController.updateCategory);
router.delete('/categories/:id', auth_1.authenticateToken, categoryController.deleteCategory);
// Products
router.get('/products', auth_1.authenticateToken, productController.listProducts);
router.get('/products/:id', auth_1.authenticateToken, productController.getProduct);
router.post('/products', auth_1.authenticateToken, productController.createProduct);
router.put('/products/:id', auth_1.authenticateToken, productController.updateProduct);
router.delete('/products/:id', auth_1.authenticateToken, productController.deleteProduct); // Soft Delete
router.patch('/products/:id/toggle', auth_1.authenticateToken, productController.toggleActive);
exports.default = router;
//# sourceMappingURL=menu.routes.js.map