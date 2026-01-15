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
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategory = exports.listCategories = void 0;
const categoryService = __importStar(require("../services/category.service"));
const response_1 = require("../utils/response");
const listCategories = async (req, res, next) => {
    try {
        const categories = await categoryService.getCategories();
        (0, response_1.sendSuccess)(res, categories);
    }
    catch (error) {
        next(error);
    }
};
exports.listCategories = listCategories;
const getCategory = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const category = await categoryService.getCategoryById(id);
        (0, response_1.sendSuccess)(res, category);
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};
exports.getCategory = getCategory;
const createCategory = async (req, res, next) => {
    try {
        const category = await categoryService.createCategory(req.body);
        (0, response_1.sendSuccess)(res, category, undefined, 201);
    }
    catch (error) {
        if (error.code === 'VALIDATION_ERROR')
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const category = await categoryService.updateCategory(id, req.body);
        (0, response_1.sendSuccess)(res, category);
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'VALIDATION_ERROR')
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        await categoryService.deleteCategory(id);
        (0, response_1.sendSuccess)(res, { message: 'Category deleted' });
    }
    catch (error) {
        if (error.code === 'NOT_FOUND')
            return (0, response_1.sendError)(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'CONFLICT')
            return (0, response_1.sendError)(res, 'CONFLICT', error.message, null, 409);
        next(error);
    }
};
exports.deleteCategory = deleteCategory;
//# sourceMappingURL=category.controller.js.map