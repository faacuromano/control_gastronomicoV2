import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/category.service';
import { sendSuccess, sendError } from '../utils/response';

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await categoryService.getCategories();
        sendSuccess(res, categories);
    } catch (error) {
        next(error);
    }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const category = await categoryService.getCategoryById(id);
        sendSuccess(res, category);
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        next(error);
    }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const category = await categoryService.createCategory(req.body);
        sendSuccess(res, category, undefined, 201);
    } catch (error: any) {
        if (error.code === 'VALIDATION_ERROR') return sendError(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        const category = await categoryService.updateCategory(id, req.body);
        sendSuccess(res, category);
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'VALIDATION_ERROR') return sendError(res, 'VALIDATION_ERROR', error.message, error.details, 400);
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id as string);
        await categoryService.deleteCategory(id);
        sendSuccess(res, { message: 'Category deleted' });
    } catch (error: any) {
        if (error.code === 'NOT_FOUND') return sendError(res, 'NOT_FOUND', error.message, null, 404);
        if (error.code === 'CONFLICT') return sendError(res, 'CONFLICT', error.message, null, 409);
        next(error);
    }
};
