import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.service';
import { sendSuccess, sendError } from '../utils/response';

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { categoryId, isActive } = req.query;
        const filters: any = {};
        if (categoryId) filters.categoryId = parseInt(categoryId as string);
        if (isActive !== undefined) filters.isActive = isActive === 'true';

        const products = await productService.getProducts(filters);
        sendSuccess(res, products);
    } catch (error) {
        next(error);
    }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const product = await productService.getProductById(id);
        sendSuccess(res, product);
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const product = await productService.createProduct(req.body);
        sendSuccess(res, product, undefined, 201);
    } catch (error: any) {
        if (error.code === 'VALIDATION_ERROR') return sendError(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const product = await productService.updateProduct(id, req.body);
        sendSuccess(res, product);
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'VALIDATION_ERROR') return sendError(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};

export const toggleActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const product = await productService.toggleProductActive(id);
        sendSuccess(res, product);
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        await productService.deleteProduct(id);
        sendSuccess(res, { message: 'Product deactivated (Soft Delete)' });
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};
