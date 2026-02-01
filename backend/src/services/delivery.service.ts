/**
 * @fileoverview Delivery Service
 * Manages delivery platforms and drivers
 */

import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';
import type { DeliveryPlatform, DeliveryDriver, VehicleType } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

// ============================================================================
// PLATFORM MANAGEMENT
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
    config?: any;
}

class DeliveryService {
    // ========================================================================
    // PLATFORMS
    // ========================================================================

    async getAllPlatforms(tenantId: number): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            include: {
                tenantConfigs: { where: { tenantId } }
            },
            orderBy: { name: 'asc' }
        });
    }

    async getPlatformById(id: number, tenantId: number): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findUnique({
            where: { id },
            include: {
                tenantConfigs: { where: { tenantId } }
            }
        });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        return platform;
    }

    async getPlatformByCode(code: string, tenantId: number): Promise<DeliveryPlatform | null> {
        return prisma.deliveryPlatform.findUnique({
            where: { code },
            include: {
                tenantConfigs: { where: { tenantId } }
            }
        });
    }

    async createPlatform(data: PlatformCreateData): Promise<DeliveryPlatform> {
        return prisma.deliveryPlatform.create({
            data: {
                code: data.code.toUpperCase(),
                name: data.name,
                apiKey: data.apiKey ?? null,
                webhookSecret: data.webhookSecret ?? null,
                storeId: data.storeId ?? null
            }
        });
    }

    async updatePlatform(id: number, data: PlatformUpdateData): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findUnique({ where: { id } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        return prisma.deliveryPlatform.update({
            where: { id },
            data
        });
    }

    async togglePlatform(id: number): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findUnique({ where: { id } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        return prisma.deliveryPlatform.update({
            where: { id },
            data: { isEnabled: !platform.isEnabled }
        });
    }

    async deletePlatform(id: number): Promise<void> {
        const platform = await prisma.deliveryPlatform.findUnique({ where: { id } });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        await prisma.deliveryPlatform.delete({
            where: { id }
        });
    }

    async getEnabledPlatforms(tenantId: number): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            where: { isEnabled: true },
            include: {
                tenantConfigs: { where: { tenantId } }
            },
            orderBy: { name: 'asc' }
        });
    }

    // ========================================================================
    // DRIVERS
    // ========================================================================

    async getAllDrivers(tenantId: number): Promise<DeliveryDriver[]> {
        return prisma.deliveryDriver.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
    }

    async getDriverById(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await prisma.deliveryDriver.findFirst({
            where: { id, tenantId }
        });
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }
        return driver;
    }

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

    async createDriver(tenantId: number, data: {
        name: string;
        phone: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
    }): Promise<DeliveryDriver> {
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

    async updateDriver(id: number, tenantId: number, data: {
        name?: string;
        phone?: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
        isActive?: boolean;
    }): Promise<DeliveryDriver> {
        // Verify tenant ownership and get current state
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

    async toggleDriverAvailability(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.updateMany({
            where: { id, tenantId },
            data: { isAvailable: !driver.isAvailable }
        });
        return this.getDriverById(id, tenantId);
    }

    async toggleDriverActive(id: number, tenantId: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.updateMany({
            where: { id, tenantId },
            data: { isActive: !driver.isActive }
        });
        return this.getDriverById(id, tenantId);
    }

    async assignDriverToOrder(driverId: number, orderId: number, tenantId: number): Promise<void> {
        // Verify ownership
        const driver = await prisma.deliveryDriver.findFirst({ where: { id: driverId, tenantId } });
        if (!driver) throw new NotFoundError('Driver');
        
        const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order) throw new NotFoundError('Order');

        // SAFE: findFirst at L187-L191 verifies tenant ownership for both driver and order
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

    async deleteDriver(id: number, tenantId: number): Promise<void> {
        await this.getDriverById(id, tenantId);
        await prisma.deliveryDriver.deleteMany({
            where: { id, tenantId }
        });
    }

    // ========================================================================
    // ORDER DELIVERY HELPERS
    // ========================================================================

    async getDeliveryOrders(tenantId: number, status?: string): Promise<any[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.order.findMany({
            where: {
                tenantId,
                // FIX: Only show delivery orders (exclude POS and DINE_IN)
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                // Filter by status if provided, otherwise show today's active + delivered
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
                driver: true, // Include User driver for POS delivery orders
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
