import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import * as productService from '../services/product.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId, isActive } = req.query;
    const filters: Prisma.ProductWhereInput = {};
    if (categoryId) filters.categoryId = parseInt(categoryId as string);
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const products = await productService.getProducts(filters);
    sendSuccess(res, products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.getProductById(id);
    sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.createProduct(req.body);
    sendSuccess(res, product, undefined, 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.updateProduct(id, req.body);
    sendSuccess(res, product);
});

export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.toggleProductActive(id);
    sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await productService.deleteProduct(id);
    sendSuccess(res, { message: 'Product deactivated (Soft Delete)' });
});
