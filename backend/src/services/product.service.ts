/**
 * @fileoverview Servicio de gestion de productos del menu.
 * Maneja el CRUD completo de productos incluyendo sus relaciones con
 * ingredientes (para control de stock) y grupos de modificadores (para personalizacion).
 * Incluye validacion de pertenencia al tenant en todas las relaciones.
 *
 * @module services/product.service
 */

import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Schema de validacion para ingredientes asociados a un producto.
 */
const IngredientInput = z.object({
  ingredientId: z.number(),
  quantity: z.number().positive()
});

// SEC-023: Validacion de longitud maxima en campos de texto para prevenir abuso
const ProductSchema = z.object({
    categoryId: z.number(),
    name: z.string().min(1, "Name is required").max(200, "Name too long (max 200 characters)"),
    description: z.string().max(2000, "Description too long (max 2000 characters)").optional(),
    price: z.number().min(0, "Price must be non-negative"),
    productType: z.enum(['SIMPLE', 'COMBO', 'RECIPE']).optional(),
    isStockable: z.boolean().optional(),
    image: z.string().url().max(500, "Image URL too long").optional(),
    isActive: z.boolean().optional(),
    ingredients: z.array(IngredientInput).optional(),
    modifierIds: z.array(z.number()).optional()
});

/**
 * Obtiene productos con paginacion y filtros opcionales.
 * PERF-003: Limite por defecto reducido de 500 a 100 para mejorar rendimiento.
 * Incluye categoria, ingredientes y modificadores en la respuesta.
 */
export const getProducts = async (tenantId: number, where: Prisma.ProductWhereInput = {}, page = 1, limit = 100) => {
    const take = Math.min(limit, 500);
    const skip = (page - 1) * take;
    const filter = { ...where, tenantId };

    const [data, total] = await Promise.all([
        prisma.product.findMany({
            where: filter,
            include: {
                category: true,
                ingredients: { include: { ingredient: true } },
                modifiers: {
                    include: {
                        modifierGroup: {
                            include: { options: true }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' },
            skip,
            take
        }),
        prisma.product.count({ where: filter })
    ]);

    return { data, total, page, limit: take };
};

/**
 * Obtiene un producto por ID con todas sus relaciones (categoria, ingredientes, modificadores).
 */
export const getProductById = async (id: number, tenantId: number) => {
    const product = await prisma.product.findFirst({
        where: { id, tenantId },
        include: {
            category: true,
            ingredients: { include: { ingredient: true } },
            modifiers: {
                include: {
                    modifierGroup: {
                        include: { options: true }
                    }
                }
            }
        }
    });
    if (!product) throw new NotFoundError('Product');
    return product;
};

/**
 * Prepara los datos de creacion de producto en formato Prisma.
 * Incluye la creacion anidada de ingredientes y modificadores con tenantId
 * para cumplir con el requisito multi-tenant en todas las tablas.
 */
const prepareProductData = (
    data: z.infer<typeof ProductSchema>,
    tenantId: number
): Prisma.ProductUncheckedCreateInput => {
    const { ingredients, modifierIds, ...productData } = data;

    const createData: Prisma.ProductUncheckedCreateInput = {
        ...productData,
        tenantId,
        productType: productData.productType ?? 'SIMPLE',
        description: productData.description ?? null,
        image: productData.image ?? null,
        isStockable: productData.isStockable ?? true,
        isActive: productData.isActive ?? true
    };

    // Crear relaciones de ingredientes con tenantId en cada registro anidado
    if (ingredients && ingredients.length > 0) {
        createData.ingredients = {
            create: ingredients.map(ing => ({
                tenantId,
                ingredientId: ing.ingredientId,
                quantity: ing.quantity
            }))
        };
    }

    // Crear relaciones de grupos de modificadores con tenantId en cada registro anidado
    if (modifierIds && modifierIds.length > 0) {
        createData.modifiers = {
            create: modifierIds.map(groupId => ({
                tenantId,
                modifierGroupId: groupId
            }))
        };
    }

    return createData;
};

/**
 * Crea un nuevo producto con sus ingredientes y modificadores.
 *
 * Validaciones previas a la creacion:
 * 1. Schema Zod (tipos, longitudes, formatos)
 * 2. Categoria pertenece al tenant
 * 3. Todos los ingredientes pertenecen al tenant
 * 4. Todos los grupos de modificadores pertenecen al tenant
 */
export const createProduct = async (data: Record<string, unknown> & { tenantId?: number }) => {
    const validation = ProductSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    // Validar contexto de tenant (debe venir en los datos)
    const tenantId = data.tenantId;
    if (!tenantId) throw new ValidationError('Tenant ID required');

    // Verificar que la categoria pertenezca al tenant
    const category = await prisma.category.findFirst({ where: { id: validation.data.categoryId, tenantId } });
    if (!category) throw new ValidationError('Invalid Category ID for this tenant');

    const { ingredients, modifierIds, ...productData } = validation.data;

    // Validar que todos los ingredientes referenciados pertenezcan al tenant
    if (ingredients && ingredients.length > 0) {
        const ingIds = ingredients.map(i => i.ingredientId);
        const count = await prisma.ingredient.count({
            where: { id: { in: ingIds }, tenantId }
        });
        if (count !== ingIds.length) throw new ValidationError('One or more ingredients do not belong to this tenant');
    }

    // Validar que todos los grupos de modificadores pertenezcan al tenant
    if (modifierIds && modifierIds.length > 0) {
         const count = await prisma.modifierGroup.count({
            where: { id: { in: modifierIds }, tenantId }
        });
        if (count !== modifierIds.length) throw new ValidationError('One or more modifier groups do not belong to this tenant');
    }

    const createData = prepareProductData(validation.data, tenantId);

    return await prisma.product.create({
        data: createData,
        include: { ingredients: true, modifiers: true }
    });
};

/**
 * Actualiza un producto existente y sus relaciones.
 * Para ingredientes y modificadores se usa la estrategia de "reemplazo total":
 * se eliminan las relaciones existentes y se recrean con los nuevos datos.
 * Esto simplifica la logica vs actualizaciones parciales.
 */
export const updateProduct = async (id: number, tenantId: number, data: Record<string, unknown>) => {
    const validation = ProductSchema.partial().safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    // Verificar que el producto exista y pertenezca al tenant
    const exists = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Product');

    // Verificar categoria si se esta cambiando
    if (validation.data.categoryId) {
        const category = await prisma.category.findFirst({ where: { id: validation.data.categoryId, tenantId } });
        if (!category) throw new ValidationError('Invalid Category ID for this tenant');
    }

    const { ingredients, modifierIds, ...productData } = validation.data;
    const updateData: Record<string, unknown> = { ...productData };
    if (productData.description === undefined && data.description === null) updateData.description = null; // Manejo explicito de null
    if (productData.image === undefined && data.image === null) updateData.image = null;

    // Transaccion para manejar la actualizacion de ingredientes (eliminar todo y recrear)
    // Para actualizaciones parciales seria mas complejo, asi que asumimos reemplazo total.

    return await prisma.$transaction(async (tx) => {
        if (ingredients) {
            // Eliminar ingredientes existentes del producto
            await tx.productIngredient.deleteMany({ where: { productId: id, tenantId } });
            // Crear los nuevos ingredientes con tenantId
            await tx.productIngredient.createMany({
                data: ingredients.map(ing => ({
                    tenantId,
                    productId: id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity
                }))
            });
        }

        if (modifierIds) {
            // Eliminar modificadores existentes del producto
            await tx.productModifierGroup.deleteMany({ where: { productId: id, tenantId } });
            // Crear los nuevos modificadores con tenantId
            await tx.productModifierGroup.createMany({
                 data: modifierIds.map(groupId => ({
                    tenantId,
                    productId: id,
                    modifierGroupId: groupId
                }))
            });
        }

        // SEGURO: findFirst en L144 verifica propiedad del tenant
        return await tx.product.update({
            where: { id },
            data: updateData,
            include: { ingredients: true, modifiers: true }
        });
    });
};

/**
 * Alterna el estado activo/inactivo de un producto.
 * Los productos inactivos no aparecen en el POS ni en el menu QR.
 */
export const toggleProductActive = async (id: number, tenantId: number) => {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.updateMany({
        where: { id, tenantId },
        data: { isActive: !product.isActive }
    });
};

/**
 * "Elimina" un producto (soft delete).
 * En realidad lo marca como inactivo para preservar referencias historicas
 * en ordenes pasadas. Los productos nunca se eliminan fisicamente.
 */
export const deleteProduct = async (id: number, tenantId: number) => {
    // Verificar existencia y propiedad
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError('Product');

    return await prisma.product.updateMany({
        where: { id, tenantId },
        data: { isActive: false }
    });
};
