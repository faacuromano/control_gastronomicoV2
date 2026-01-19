"use strict";
/**
 * @fileoverview Delivery Service
 * Manages delivery platforms and drivers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
class DeliveryService {
    // ========================================================================
    // PLATFORMS
    // ========================================================================
    async getAllPlatforms() {
        return prisma_1.prisma.deliveryPlatform.findMany({
            orderBy: { name: 'asc' }
        });
    }
    async getPlatformById(id) {
        const platform = await prisma_1.prisma.deliveryPlatform.findUnique({
            where: { id }
        });
        if (!platform) {
            throw new errors_1.NotFoundError('Platform not found');
        }
        return platform;
    }
    async getPlatformByCode(code) {
        return prisma_1.prisma.deliveryPlatform.findUnique({
            where: { code }
        });
    }
    async createPlatform(data) {
        return prisma_1.prisma.deliveryPlatform.create({
            data: {
                code: data.code.toUpperCase(),
                name: data.name,
                apiKey: data.apiKey,
                webhookSecret: data.webhookSecret,
                storeId: data.storeId,
                commissionRate: data.commissionRate
            }
        });
    }
    async updatePlatform(id, data) {
        return prisma_1.prisma.deliveryPlatform.update({
            where: { id },
            data
        });
    }
    async togglePlatform(id) {
        const platform = await this.getPlatformById(id);
        return prisma_1.prisma.deliveryPlatform.update({
            where: { id },
            data: { isEnabled: !platform.isEnabled }
        });
    }
    async deletePlatform(id) {
        await prisma_1.prisma.deliveryPlatform.delete({
            where: { id }
        });
    }
    async getEnabledPlatforms() {
        return prisma_1.prisma.deliveryPlatform.findMany({
            where: { isEnabled: true },
            orderBy: { name: 'asc' }
        });
    }
    // ========================================================================
    // DRIVERS
    // ========================================================================
    async getAllDrivers() {
        return prisma_1.prisma.deliveryDriver.findMany({
            orderBy: { name: 'asc' }
        });
    }
    async getDriverById(id) {
        const driver = await prisma_1.prisma.deliveryDriver.findUnique({
            where: { id }
        });
        if (!driver) {
            throw new errors_1.NotFoundError('Driver not found');
        }
        return driver;
    }
    async getAvailableDrivers() {
        return prisma_1.prisma.deliveryDriver.findMany({
            where: {
                isActive: true,
                isAvailable: true
            },
            orderBy: { name: 'asc' }
        });
    }
    async createDriver(data) {
        return prisma_1.prisma.deliveryDriver.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email,
                vehicleType: data.vehicleType || 'MOTORCYCLE',
                licensePlate: data.licensePlate
            }
        });
    }
    async updateDriver(id, data) {
        return prisma_1.prisma.deliveryDriver.update({
            where: { id },
            data
        });
    }
    async toggleDriverAvailability(id) {
        const driver = await this.getDriverById(id);
        return prisma_1.prisma.deliveryDriver.update({
            where: { id },
            data: { isAvailable: !driver.isAvailable }
        });
    }
    async toggleDriverActive(id) {
        const driver = await this.getDriverById(id);
        return prisma_1.prisma.deliveryDriver.update({
            where: { id },
            data: { isActive: !driver.isActive }
        });
    }
    async assignDriverToOrder(driverId, orderId) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.order.update({
                where: { id: orderId },
                data: { deliveryDriverId: driverId }
            }),
            prisma_1.prisma.deliveryDriver.update({
                where: { id: driverId },
                data: {
                    isAvailable: false,
                    currentOrderId: orderId
                }
            })
        ]);
    }
    async releaseDriver(driverId) {
        return prisma_1.prisma.deliveryDriver.update({
            where: { id: driverId },
            data: {
                isAvailable: true,
                currentOrderId: null
            }
        });
    }
    async deleteDriver(id) {
        await prisma_1.prisma.deliveryDriver.delete({
            where: { id }
        });
    }
    // ========================================================================
    // ORDER DELIVERY HELPERS
    // ========================================================================
    async getDeliveryOrders(status) {
        return prisma_1.prisma.order.findMany({
            where: {
                fulfillmentType: {
                    in: ['PLATFORM_DELIVERY', 'SELF_DELIVERY']
                },
                ...(status ? { status: status } : {})
            },
            include: {
                client: true,
                deliveryPlatform: true,
                deliveryDriver: true,
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
exports.deliveryService = new DeliveryService();
//# sourceMappingURL=delivery.service.js.map