/**
 * @fileoverview Servicio de categorías de productos.
 *
 * Gestiona el CRUD de categorías del menú. Cada categoría agrupa productos
 * y puede tener una impresora asignada para dirigir la impresión de comanda
 * al área correcta (cocina, barra, pastelería, etc.).
 *
 * Las categorías están aisladas por tenant y tienen restricción de unicidad
 * @@unique([tenantId, name]) en el esquema Prisma.
 *
 * @module services/category.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

// SEC-023: Validación de longitud máxima en campos de texto para prevenir abuso
const CategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name too long (max 100 characters)"),
    printerId: z.number().optional(),
});

/**
 * Obtiene todas las categorías del tenant con conteo de productos activos e inactivos.
 * El conteo de productos activos se usa en el POS para filtrar categorías vacías.
 */
export const getCategories = async (tenantId: number) => {
    const categories = await prisma.category.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        include: {
            products: {
                select: { isActive: true }
            }
        }
    });

    return categories.map(category => ({
        id: category.id,
        name: category.name,
        printerId: category.printerId,
        // Contar productos activos para filtrado en POS (ocultar categorías vacías)
        activeProductsCount: category.products.filter(p => p.isActive).length,
        // Total de productos para uso interno/admin
        totalProductsCount: category.products.length
    }));
};

/**
 * Obtiene una categoría por ID con todos sus productos.
 * Aislada por tenantId para seguridad multi-inquilino.
 */
export const getCategoryById = async (id: number, tenantId: number) => {
    const category = await prisma.category.findFirst({
        where: { id, tenantId },
        include: { products: true }
    });
    if (!category) throw new NotFoundError('Category');
    return category;
};

/**
 * Crea una nueva categoría validando el esquema de entrada.
 * La restricción de unicidad [tenantId, name] en BD previene duplicados.
 */
export const createCategory = async (data: { tenantId: number; name: string; printerId?: number }) => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    return await prisma.category.create({
        data: {
            tenantId: data.tenantId,
            name: validation.data.name,
            printerId: validation.data.printerId ?? null
        }
    });
};

/**
 * Actualiza una categoría existente.
 * Usa updateMany con tenantId en el WHERE como defensa en profundidad contra acceso cross-tenant.
 */
export const updateCategory = async (id: number, tenantId: number, data: { name?: string; printerId?: number }) => {
    const validation = CategorySchema.partial().safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid data', validation.error.issues);
    }

    const exists = await prisma.category.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundError('Category');

    const updateData: Prisma.CategoryUncheckedUpdateManyInput = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.printerId !== undefined) updateData.printerId = validation.data.printerId;

    // Defensa en profundidad: updateMany incluye tenantId en el WHERE
    return await prisma.category.updateMany({
        where: { id, tenantId },
        data: updateData
    });
};

/**
 * Elimina una categoría y sus productos inactivos asociados.
 * DB-012: Envuelto en transacción para prevenir fallos de cascada concurrente.
 * No permite eliminar categorías que aún tengan productos activos.
 */
export const deleteCategory = async (id: number, tenantId: number) => {
    // DB-012: Verificación + eliminación en transacción para evitar inconsistencias por concurrencia
    return await prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
            where: { id, tenantId },
            include: { products: { select: { isActive: true } } }
        });

        if (!category) throw new NotFoundError('Category');

        const activeProducts = category.products.filter(p => p.isActive);
        const inactiveProducts = category.products.filter(p => !p.isActive);

        if (activeProducts.length > 0) {
            throw new ConflictError('Cannot delete category with active products');
        }

        // Si hay productos inactivos, eliminarlos primero para permitir la eliminación de la categoría
        if (inactiveProducts.length > 0) {
            await tx.product.deleteMany({
                where: { categoryId: id, tenantId }
            });
        }

        // Defensa en profundidad: deleteMany incluye tenantId en el WHERE
        return await tx.category.deleteMany({
            where: { id, tenantId }
        });
    });
};
