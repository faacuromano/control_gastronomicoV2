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
exports.deleteProduct = exports.toggleActive = exports.updateProduct = exports.createProduct = exports.getProduct = exports.listProducts = void 0;
const productService = __importStar(require("../services/product.service"));
const response_1 = require("../utils/response");
const listProducts = async (req, res, next) => {
    try {
        const { categoryId, isActive } = req.query;
        const filters = {};
        if (categoryId)
            filters.categoryId = parseInt(categoryId);
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        const products = await productService.getProducts(filters);
        (0, response_1.sendSuccess)(res, products);
    }
    catch (error) {
        next(error);
    }
};
exports.listProducts = listProducts;
const getProduct = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const product = await productService.getProductById(id);
        (0, response_1.sendSuccess)(res, product);
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};
exports.getProduct = getProduct;
const createProduct = async (req, res, next) => {
    try {
        const product = await productService.createProduct(req.body);
        (0, response_1.sendSuccess)(res, product, undefined, 201);
    }
    catch (error) {
        if (error.code === 'VALIDATION_ERROR')
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const product = await productService.updateProduct(id, req.body);
        (0, response_1.sendSuccess)(res, product);
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'VALIDATION_ERROR')
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};
exports.updateProduct = updateProduct;
const toggleActive = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const product = await productService.toggleProductActive(id);
        (0, response_1.sendSuccess)(res, product);
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};
exports.toggleActive = toggleActive;
const deleteProduct = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        await productService.deleteProduct(id);
        (0, response_1.sendSuccess)(res, { message: 'Product deactivated (Soft Delete)' });
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};
exports.deleteProduct = deleteProduct;
//# sourceMappingURL=product.controller.js.map