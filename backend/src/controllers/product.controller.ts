/**
 * @fileoverview Controlador de Productos del Menú
 *
 * CRUD para los productos que se venden en el restaurante.
 * Cada producto pertenece a una categoría y puede tener ingredientes asociados
 * (para control de inventario), modificadores (para personalización) y precios
 * por canal de delivery. Soporta tipos SIMPLE, COMBO y RECIPE.
 *
 * La eliminación es lógica (soft-delete via isActive=false) para mantener
 * integridad referencial con órdenes históricas.
 *
 * @module controllers/product.controller
 */

import { Request, Response } from 'express';
import { Prisma, AuditAction } from '@prisma/client';
import * as productService from '../services/product.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService } from '../services/audit.service';

/**
 * Lista productos con filtros opcionales de categoría y estado activo.
 * Soporta paginación con un límite alto por defecto (500) porque el POS necesita
 * cargar el catálogo completo para funcionamiento offline.
 */
export const listProducts = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId, isActive, page: pageStr, limit: limitStr } = req.query;
    const filters: Prisma.ProductWhereInput = {};
    if (categoryId) filters.categoryId = parseInt(categoryId as string);
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(limitStr as string) || 500), 500);
    const result = await productService.getProducts(req.user!.tenantId!, filters, page, limit);
    sendSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit, totalPages: Math.ceil(result.total / result.limit) });
});

/** Obtiene un producto por ID con todos sus detalles (categoría, ingredientes, modificadores) */
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.getProductById(id, req.user!.tenantId!);
    sendSuccess(res, product);
});

/** Crea un nuevo producto asociado al tenant con registro de auditoría */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.createProduct({
        ...req.body,
        tenantId: req.user!.tenantId!
    });

    // Auditoría: registrar creación del producto
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

/** Actualiza un producto existente con registro de auditoría */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.updateProduct(id, req.user!.tenantId!, req.body);

    // Auditoría: registrar modificación del producto
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

/** Alterna el estado activo/inactivo de un producto (toggle) */
export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const product = await productService.toggleProductActive(id, req.user!.tenantId!);
    sendSuccess(res, product);
});

/**
 * Desactiva un producto (soft-delete).
 * No se elimina físicamente para mantener integridad con órdenes históricas.
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await productService.deleteProduct(id, req.user!.tenantId!);

    // Auditoría: registrar eliminación lógica
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

    sendSuccess(res, { message: 'Producto desactivado (eliminación lógica)' });
});
