/**
 * @fileoverview Delivery Service
 * Manages delivery platforms and drivers
 */

import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';
import type { DeliveryPlatform, DeliveryDriver, VehicleType } from '@prisma/client';

// ============================================================================
// PLATFORM MANAGEMENT
// ============================================================================

export interface PlatformCreateData {
    code: string;
    name: string;
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
    commissionRate?: number;
}

export interface PlatformUpdateData {
    name?: string;
    isEnabled?: boolean;
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
    menuSyncEnabled?: boolean;
    commissionRate?: number;
    config?: any;
}

class DeliveryService {
    // ========================================================================
    // PLATFORMS
    // ========================================================================

    async getAllPlatforms(): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            orderBy: { name: 'asc' }
        });
    }

    async getPlatformById(id: number): Promise<DeliveryPlatform> {
        const platform = await prisma.deliveryPlatform.findUnique({
            where: { id }
        });
        if (!platform) {
            throw new NotFoundError('Platform not found');
        }
        return platform;
    }

    async getPlatformByCode(code: string): Promise<DeliveryPlatform | null> {
        return prisma.deliveryPlatform.findUnique({
            where: { code }
        });
    }

    async createPlatform(data: PlatformCreateData): Promise<DeliveryPlatform> {
        return prisma.deliveryPlatform.create({
            data: {
                code: data.code.toUpperCase(),
                name: data.name,
                apiKey: data.apiKey ?? null,
                webhookSecret: data.webhookSecret ?? null,
                storeId: data.storeId ?? null,
                commissionRate: data.commissionRate ?? null
            }
        });
    }

    async updatePlatform(id: number, data: PlatformUpdateData): Promise<DeliveryPlatform> {
        return prisma.deliveryPlatform.update({
            where: { id },
            data
        });
    }

    async togglePlatform(id: number): Promise<DeliveryPlatform> {
        const platform = await this.getPlatformById(id);
        return prisma.deliveryPlatform.update({
            where: { id },
            data: { isEnabled: !platform.isEnabled }
        });
    }

    async deletePlatform(id: number): Promise<void> {
        await prisma.deliveryPlatform.delete({
            where: { id }
        });
    }

    async getEnabledPlatforms(): Promise<DeliveryPlatform[]> {
        return prisma.deliveryPlatform.findMany({
            where: { isEnabled: true },
            orderBy: { name: 'asc' }
        });
    }

    // ========================================================================
    // DRIVERS
    // ========================================================================

    async getAllDrivers(): Promise<DeliveryDriver[]> {
        return prisma.deliveryDriver.findMany({
            orderBy: { name: 'asc' }
        });
    }

    async getDriverById(id: number): Promise<DeliveryDriver> {
        const driver = await prisma.deliveryDriver.findUnique({
            where: { id }
        });
        if (!driver) {
            throw new NotFoundError('Driver not found');
        }
        return driver;
    }

    async getAvailableDrivers(): Promise<DeliveryDriver[]> {
        return prisma.deliveryDriver.findMany({
            where: {
                isActive: true,
                isAvailable: true
            },
            orderBy: { name: 'asc' }
        });
    }

    async createDriver(data: {
        name: string;
        phone: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
    }): Promise<DeliveryDriver> {
        return prisma.deliveryDriver.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email ?? null,
                vehicleType: data.vehicleType ?? 'MOTORCYCLE',
                licensePlate: data.licensePlate ?? null
            }
        });
    }

    async updateDriver(id: number, data: {
        name?: string;
        phone?: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
        isActive?: boolean;
    }): Promise<DeliveryDriver> {
        return prisma.deliveryDriver.update({
            where: { id },
            data
        });
    }

    async toggleDriverAvailability(id: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id);
        return prisma.deliveryDriver.update({
            where: { id },
            data: { isAvailable: !driver.isAvailable }
        });
    }

    async toggleDriverActive(id: number): Promise<DeliveryDriver> {
        const driver = await this.getDriverById(id);
        return prisma.deliveryDriver.update({
            where: { id },
            data: { isActive: !driver.isActive }
        });
    }

    async assignDriverToOrder(driverId: number, orderId: number): Promise<void> {
        await prisma.$transaction([
            prisma.order.update({
                where: { id: orderId },
                data: { deliveryDriverId: driverId }
            }),
            prisma.deliveryDriver.update({
                where: { id: driverId },
                data: { 
                    isAvailable: false,
                    currentOrderId: orderId
                }
            })
        ]);
    }

    async releaseDriver(driverId: number): Promise<DeliveryDriver> {
        return prisma.deliveryDriver.update({
            where: { id: driverId },
            data: {
                isAvailable: true,
                currentOrderId: null
            }
        });
    }

    async deleteDriver(id: number): Promise<void> {
        await prisma.deliveryDriver.delete({
            where: { id }
        });
    }

    // ========================================================================
    // ORDER DELIVERY HELPERS
    // ========================================================================

    async getDeliveryOrders(status?: string): Promise<any[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.order.findMany({
            where: {
                // FIX: Only show delivery orders (exclude POS and DINE_IN)
                fulfillmentType: { in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY', 'TAKEAWAY'] },
                // Filter by status if provided, otherwise show today's active + delivered
                ...(status ? { status: status as any } : {
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
