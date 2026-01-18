import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await categoryService.getCategories();
    sendSuccess(res, categories);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const category = await categoryService.getCategoryById(id);
    sendSuccess(res, category);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.createCategory(req.body);
    sendSuccess(res, category, undefined, 201);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const category = await categoryService.updateCategory(id, req.body);
    sendSuccess(res, category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await categoryService.deleteCategory(id);
    sendSuccess(res, { message: 'Category deleted' });
});
