/**
 * @fileoverview Servicio de delivery (entregas a domicilio).
 *
 * Gestiona plataformas de delivery (PedidosYa, Rappi, etc.) y conductores propios.
 * Incluye CRUD completo de plataformas y conductores, asignación de conductores a órdenes,
 * y consulta de órdenes de delivery activas.
 *
 * SEGURIDAD: Todas las operaciones de plataformas y conductores están aisladas por tenantId.
 * Cada tenant puede configurar sus propias plataformas y gestionar su flota de conductores.
 *
 * @module services/delivery.service
 */

import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';
import type { DeliveryPlatform, DeliveryDriver, VehicleType } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

// ============================================================================
// GESTIÓN DE PLATAFORMAS DE DELIVERY
// ============================================================================

export interface PlatformCreateData {
    code: string;
    name: string;
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
}

export interface PlatformUpdateData {
    name?: string;
    isEnabled?: boolean;
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
    menuSyncEnabled?: boolean;
    config?: Record<string, unknown>;
}

export interface DriverCreateData {
    name: string;
    phone: string;
    email?: string;
    vehicleType?: VehicleType;
    licensePlate?: string;
}

export interface DriverUpdateData {
    name?: string;
    phone?: string;
    email?: string;
    vehicleType?: VehicleType;
    licensePlate?: string;
    isActive?: boolean;
}

class DeliveryService {
    // ========================================================================
    // PLATAFORMAS DE DELIVERY (PedidosYa, Rappi, etc.)
    // ========================================================================

    /**
     * Obtiene todas las plataformas de delivery del tenant con su configuración.
     */
    async getAllPlatforms(tenantId: number): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            where: { tenantId },
            include: {
                tenantConfigs: { where: { tenantId } }
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Obtiene una plataforma por ID, verificando propiedad del tenant.
     */
    async getPlatformById(id: number, tenantId: number): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findFirst({
            where: { id, tenantId },
            include: {
                tenantConfigs: { where: { tenantId } }
            }
        });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        return platform;
    }

    /**
     * Busca una plataforma por su código único dentro del tenant.
     */
    async getPlatformByCode(code: string, tenantId: number): Promise<DeliveryPlatform | null> {
        return prisma.deliveryPlatform.findFirst({
            where: { code, tenantId },
            include: {
                tenantConfigs: { where: { tenantId } }
            }
        });
    }

    /**
     * Crea una nueva plataforma de delivery.
     * FIX P0-SEC-001: Todas las operaciones CRUD de plataformas ahora aisladas por tenantId.
     */
    async createPlatform(tenantId: number, data: PlatformCreateData): Promise<DeliveryPlatform> {
        return prisma.deliveryPlatform.create({
            data: {
                tenantId,
                code: data.code.toUpperCase(),
                name: data.name,
                apiKey: data.apiKey ?? null,
                webhookSecret: data.webhookSecret ?? null,
                storeId: data.storeId ?? null
            }
        });
    }

    /**
     * Actualiza una plataforma existente.
     * FIX P0-SEC-002: Actualización aislada por tenantId para prevenir acceso cross-tenant.
     */
    async updatePlatform(id: number, tenantId: number, data: PlatformUpdateData): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findFirst({ where: { id, tenantId } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        const result = await prisma.deliveryPlatform.updateMany({
            where: { id, tenantId },
            data
        });
        if (result.count === 0) {
            throw new NotFoundError('Platform not found');
        }
        return prisma.deliveryPlatform.findFirst({ where: { id, tenantId } }) as Promise<DeliveryPlatform>;
    }

    /**
     * Alterna el estado habilitado/deshabilitado de una plataforma.
     * FIX P0-SEC-003: Toggle aislado por tenantId.
     */
    async togglePlatform(id: number, tenantId: number): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findFirst({ where: { id, tenantId } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        await prisma.deliveryPlatform.updateMany({
            where: { id, tenantId },
            data: { isEnabled: !platform.isEnabled }
        });
        return prisma.deliveryPlatform.findFirst({ where: { id, tenantId } }) as Promise<DeliveryPlatform>;
    }

    /**
     * Elimina una plataforma de delivery.
     * FIX P0-SEC-003: Eliminación aislada por tenantId.
     */
    async deletePlatform(id: number, tenantId: number): Promise<void> {
        const platform = await prisma.deliveryPlatform.findFirst({ where: { id, tenantId } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        await prisma.deliveryPlatform.deleteMany({
            where: { id, tenantId }
        });
    }

    /**
     * Obtiene solo las plataformas habilitadas (para mostrar en el POS).
     */
    async getEnabledPlatforms(tenantId: number): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            where: { tenantId, isEnabled: true },
            include: {
                tenantConfigs: { where: { tenantId } }
            },
            orderBy: { name: 'asc' }
        });
    }

    // ========================================================================
    // CONDUCTORES DE DELIVERY (flota propia del restaurante)
    // ========================================================================

    /**
     * Obtiene todos los conductores del tenant.
     */
    async getAllDrivers(tenantId: number): Promise<DeliveryDriver[]> {
        return prisma.deliveryDriver.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Obtiene un conductor por ID, verificando propiedad del tenant.
     */
    async getDriverById(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await prisma.deliveryDriver.findFirst({
            where: { id, tenantId }
        });
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }
        return driver;
    }

    /**
     * Obtiene conductores activos y disponibles para asignación.
     */
    async getAvailableDrivers(tenantId: number): Promise<DeliveryDriver[]> {
        return prisma.deliveryDriver.findMany({
            where: {
                isActive: true,
                isAvailable: true,
                tenantId
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Crea un nuevo conductor de delivery.
     */
    async createDriver(tenantId: number, data: DriverCreateData): Promise<DeliveryDriver> {
        return prisma.deliveryDriver.create({
            data: {
                tenantId,
                name: data.name,
                phone: data.phone,
                email: data.email ?? null,
                vehicleType: data.vehicleType ?? 'MOTORCYCLE',
                licensePlate: data.licensePlate ?? null
            }
        });
    }

    /**
     * Actualiza los datos de un conductor existente.
     * Verifica propiedad del tenant antes de actualizar.
     */
    async updateDriver(id: number, tenantId: number, data: DriverUpdateData): Promise<DeliveryDriver> {
        // Verificar propiedad del tenant y obtener estado actual
        await this.getDriverById(id, tenantId);

        const result = await prisma.deliveryDriver.updateMany({
            where: { id, tenantId },
            data
        });
        if (result.count === 0) {
            throw new NotFoundError('Driver not found');
        }
        return this.getDriverById(id, tenantId);
    }

    /**
     * Alterna la disponibilidad de un conductor (disponible/no disponible).
     */
    async toggleDriverAvailability(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.updateMany({
            where: { id, tenantId },
            data: { isAvailable: !driver.isAvailable }
        });
        return this.getDriverById(id, tenantId);
    }

    /**
     * Alterna el estado activo/inactivo de un conductor.
     */
    async toggleDriverActive(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.updateMany({
            where: { id, tenantId },
            data: { isActive: !driver.isActive }
        });
        return this.getDriverById(id, tenantId);
    }

    /**
     * Asigna un conductor a una orden de delivery.
     * Verifica propiedad del tenant tanto para el conductor como para la orden.
     * Marca al conductor como no disponible y registra la orden actual.
     */
    async assignDriverToOrder(driverId: number, orderId: number, tenantId: number): Promise<void> {
        // Verificar que ambos (conductor y orden) pertenecen al tenant
        const driver = await prisma.deliveryDriver.findFirst({ where: { id: driverId, tenantId } });
        if (!driver) throw new NotFoundError('Driver');

        const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order) throw new NotFoundError('Order');

        // SAFE: findFirst en las líneas anteriores verifica propiedad del tenant para ambos
        await prisma.$transaction([
            prisma.order.updateMany({
                where: { id: orderId, tenantId },
                data: { deliveryDriverId: driverId }
            }),
            prisma.deliveryDriver.updateMany({
                where: { id: driverId, tenantId },
                data: {
                    isAvailable: false,
                    currentOrderId: orderId
                }
            })
        ]);
    }

    /**
     * Libera un conductor tras completar una entrega.
     * Lo marca como disponible y limpia la referencia a la orden actual.
     */
    async releaseDriver(driverId: number, tenantId: number): Promise<DeliveryDriver> {
        await this.getDriverById(driverId, tenantId);
        await prisma.deliveryDriver.updateMany({
            where: { id: driverId, tenantId },
            data: {
                isAvailable: true,
                currentOrderId: null
            }
        });
        return this.getDriverById(driverId, tenantId);
    }

    /**
     * Elimina un conductor de delivery.
     */
    async deleteDriver(id: number, tenantId: number): Promise<void> {
        await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.deleteMany({
            where: { id, tenantId }
        });
    }

    // ========================================================================
    // HELPERS PARA ÓRDENES DE DELIVERY
    // ========================================================================

    /**
     * Obtiene las órdenes de delivery del tenant, filtradas por estado o mostrando
     * las activas del día más las entregadas de hoy.
     * Excluye órdenes POS/DINE_IN, solo muestra PLATFORM_DELIVERY, SELF_DELIVERY y TAKEAWAY.
     */
    async getDeliveryOrders(tenantId: number, status?: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.order.findMany({
            where: {
                tenantId,
                // Solo mostrar órdenes de delivery (excluir POS y DINE_IN)
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                // Filtrar por estado si se proporciona; de lo contrario mostrar activas + entregadas de hoy
                ...(status && Object.values(OrderStatus).includes(status as OrderStatus) ? { status: status as OrderStatus } : {
                    OR: [
                        { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
                        {
                            status: 'DELIVERED',
                            closedAt: { gte: today }
                        }
                    ]
                }),
            },
            include: {
                client: true,
                deliveryPlatform: true,
                deliveryDriver: true,
                driver: true, // Incluir User conductor para órdenes de delivery propias
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}

export const deliveryService = new DeliveryService();
