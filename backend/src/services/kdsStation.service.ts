/**
 * @fileoverview Servicio de gestión de estaciones KDS.
 * Maneja el CRUD de estaciones KDS y el enrutamiento de items a pantallas específicas.
 * Las estaciones permiten que diferentes productos vayan a diferentes pantallas de cocina
 * (ej: bebidas a la barra, platos calientes a cocina, postres a estación de postres).
 *
 * @module services/kdsStation.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Datos para crear o actualizar una estación KDS.
 */
export interface KdsStationInput {
    name: string;
    code: string;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
}

/**
 * Estaciones por defecto que se crean para nuevos tenants.
 */
const DEFAULT_STATIONS: Omit<KdsStationInput, 'isDefault'>[] = [
    { name: 'Cocina', code: 'KITCHEN', sortOrder: 1 },
    { name: 'Barra', code: 'BAR', sortOrder: 2 },
    { name: 'Fría', code: 'COLD', sortOrder: 3 },
    { name: 'Postres', code: 'DESSERT', sortOrder: 4 },
];

export class KdsStationService {
    /**
     * Obtiene todas las estaciones KDS de un tenant, ordenadas por sortOrder.
     */
    async getStations(tenantId: number) {
        return prisma.kdsStation.findMany({
            where: { tenantId },
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: {
                    select: {
                        products: true,
                        categories: true
                    }
                }
            }
        });
    }

    /**
     * Obtiene una estación por ID.
     */
    async getStation(id: number, tenantId: number) {
        const station = await prisma.kdsStation.findFirst({
            where: { id, tenantId },
            include: {
                _count: {
                    select: {
                        products: true,
                        categories: true
                    }
                }
            }
        });

        if (!station) {
            throw new NotFoundError('KDS Station');
        }

        return station;
    }

    /**
     * Obtiene una estación por código.
     */
    async getStationByCode(code: string, tenantId: number) {
        return prisma.kdsStation.findFirst({
            where: { code: code.toUpperCase(), tenantId }
        });
    }

    /**
     * Crea una nueva estación KDS.
     * El código se convierte a mayúsculas y se valida que sea único.
     */
    async createStation(tenantId: number, data: KdsStationInput) {
        // Validar datos requeridos
        if (!data.name?.trim()) {
            throw new ValidationError('Station name is required');
        }
        if (!data.code?.trim()) {
            throw new ValidationError('Station code is required');
        }

        // Normalizar código a mayúsculas y sin espacios
        const code = data.code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (code.length < 2) {
            throw new ValidationError('Station code must be at least 2 characters');
        }

        // Si es default, quitar default de las demás
        if (data.isDefault) {
            await this.clearDefaultStation(tenantId);
        }

        try {
            return await prisma.kdsStation.create({
                data: {
                    tenantId,
                    name: data.name.trim(),
                    code,
                    sortOrder: data.sortOrder ?? 0,
                    isActive: data.isActive ?? true,
                    isDefault: data.isDefault ?? false
                }
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictError(`Station with code "${code}" already exists`);
            }
            throw error;
        }
    }

    /**
     * Actualiza una estación existente.
     */
    async updateStation(id: number, tenantId: number, data: Partial<KdsStationInput>) {
        // Verificar que existe
        const existing = await prisma.kdsStation.findFirst({
            where: { id, tenantId }
        });
        if (!existing) {
            throw new NotFoundError('KDS Station');
        }

        // Si se está cambiando a default, quitar default de las demás
        if (data.isDefault && !existing.isDefault) {
            await this.clearDefaultStation(tenantId);
        }

        // Preparar datos de actualización
        const updateData: Prisma.KdsStationUpdateInput = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.code !== undefined) {
            updateData.code = data.code.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        }
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

        try {
            return await prisma.kdsStation.update({
                where: { id },
                data: updateData
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictError(`Station with code "${data.code}" already exists`);
            }
            throw error;
        }
    }

    /**
     * Elimina una estación KDS.
     * No permite eliminar si tiene productos o categorías asignados.
     */
    async deleteStation(id: number, tenantId: number) {
        const station = await prisma.kdsStation.findFirst({
            where: { id, tenantId },
            include: {
                _count: {
                    select: {
                        products: true,
                        categories: true
                    }
                }
            }
        });

        if (!station) {
            throw new NotFoundError('KDS Station');
        }

        // No permitir eliminar si tiene productos o categorías asignados
        if (station._count.products > 0 || station._count.categories > 0) {
            throw new ConflictError(
                `Cannot delete station with ${station._count.products} products and ${station._count.categories} categories assigned`
            );
        }

        await prisma.kdsStation.delete({
            where: { id }
        });

        logger.info('KDS Station deleted', { stationId: id, tenantId });
    }

    /**
     * Establece una estación como default.
     * Solo puede haber una estación default por tenant.
     */
    async setDefaultStation(id: number, tenantId: number) {
        const station = await prisma.kdsStation.findFirst({
            where: { id, tenantId }
        });

        if (!station) {
            throw new NotFoundError('KDS Station');
        }

        await prisma.$transaction([
            // Quitar default de todas las estaciones del tenant
            prisma.kdsStation.updateMany({
                where: { tenantId, isDefault: true },
                data: { isDefault: false }
            }),
            // Establecer la nueva default
            prisma.kdsStation.update({
                where: { id },
                data: { isDefault: true }
            })
        ]);

        logger.info('Default KDS Station set', { stationId: id, tenantId });

        return this.getStation(id, tenantId);
    }

    /**
     * Crea las estaciones por defecto para un tenant nuevo.
     * Llamar desde el seed o al crear un nuevo tenant.
     */
    async seedDefaultStations(tenantId: number) {
        // Verificar si ya tiene estaciones
        const existingCount = await prisma.kdsStation.count({
            where: { tenantId }
        });

        if (existingCount > 0) {
            logger.debug('Tenant already has KDS stations, skipping seed', { tenantId });
            return;
        }

        // Crear estaciones por defecto
        const stations = await prisma.kdsStation.createMany({
            data: DEFAULT_STATIONS.map((station, index) => ({
                tenantId,
                name: station.name,
                code: station.code,
                sortOrder: station.sortOrder ?? index + 1,
                isActive: true,
                isDefault: index === 0 // Primera estación (Cocina) es default
            }))
        });

        logger.info('Default KDS stations created', { tenantId, count: stations.count });

        return this.getStations(tenantId);
    }

    /**
     * Obtiene la estación default de un tenant.
     * Si no hay default, retorna null.
     */
    async getDefaultStation(tenantId: number) {
        return prisma.kdsStation.findFirst({
            where: { tenantId, isDefault: true }
        });
    }

    /**
     * Determina la estación KDS para un producto.
     * Prioridad: Product.kdsStationId > Category.kdsStationId > Default Station
     */
    async resolveStationForProduct(productId: number, tenantId: number): Promise<string | null> {
        const product = await prisma.product.findFirst({
            where: { id: productId, tenantId },
            include: {
                kdsStation: true,
                category: {
                    include: {
                        kdsStation: true
                    }
                }
            }
        });

        if (!product) return null;

        // Prioridad 1: Estación del producto
        if (product.kdsStation) {
            return product.kdsStation.code;
        }

        // Prioridad 2: Estación de la categoría
        if (product.category.kdsStation) {
            return product.category.kdsStation.code;
        }

        // Prioridad 3: Estación default del tenant
        const defaultStation = await this.getDefaultStation(tenantId);
        return defaultStation?.code ?? null;
    }

    /**
     * Determina las estaciones para múltiples productos a la vez.
     * Optimizado para reducir queries.
     */
    async resolveStationsForProducts(
        productIds: number[],
        tenantId: number
    ): Promise<Map<number, string | null>> {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId },
            include: {
                kdsStation: true,
                category: {
                    include: {
                        kdsStation: true
                    }
                }
            }
        });

        const defaultStation = await this.getDefaultStation(tenantId);
        const result = new Map<number, string | null>();

        for (const product of products) {
            let stationCode: string | null = null;

            if (product.kdsStation) {
                stationCode = product.kdsStation.code;
            } else if (product.category.kdsStation) {
                stationCode = product.category.kdsStation.code;
            } else if (defaultStation) {
                stationCode = defaultStation.code;
            }

            result.set(product.id, stationCode);
        }

        return result;
    }

    /**
     * Quita el flag default de todas las estaciones de un tenant.
     * @private
     */
    private async clearDefaultStation(tenantId: number) {
        await prisma.kdsStation.updateMany({
            where: { tenantId, isDefault: true },
            data: { isDefault: false }
        });
    }
}

export const kdsStationService = new KdsStationService();
