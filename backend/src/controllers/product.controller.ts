import { Request, Response } from 'express';
import { Prisma, AuditAction } from '@prisma/client';
import * as productService from '../services/product.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService } from '../services/audit.service';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId, isActive, page: pageStr, limit: limitStr } = req.query;
    const filters: Prisma.ProductWhereInput = {};
    if (categoryId) filters.categoryId = parseInt(categoryId as string);
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.max(1, parseInt(limitStr as string) || 500);
    const result = await productService.getProducts(req.user!.tenantId!, filters, page, limit);
    sendSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.getProductById(id, req.user!.tenantId!);
    sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.createProduct({
        ...req.body,
        tenantId: req.user!.tenantId!
    });

    // Audit log - after successful creation
    auditService.log(
        AuditAction.PRODUCT_CREATED,
        'Product',
        product.id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { name: product.name, categoryId: product.categoryId, price: product.price.toString() }
    );

    sendSuccess(res, product, undefined, 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.updateProduct(id, req.user!.tenantId!, req.body);

    // Audit log - after successful update
    auditService.log(
        AuditAction.PRODUCT_UPDATED,
        'Product',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { updates: req.body }
    );

    sendSuccess(res, product);
});

export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.toggleProductActive(id, req.user!.tenantId!);
    sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await productService.deleteProduct(id, req.user!.tenantId!);

    // Audit log - after successful deletion
    auditService.log(
        AuditAction.PRODUCT_DELETED,
        'Product',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { action: 'soft-delete' }
    );

    sendSuccess(res, { message: 'Product deactivated (Soft Delete)' });
});
