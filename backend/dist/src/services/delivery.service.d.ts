/**
 * @fileoverview Delivery Service
 * Manages delivery platforms and drivers
 */
import type { DeliveryPlatform, DeliveryDriver, VehicleType } from '@prisma/client';
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
declare class DeliveryService {
    getAllPlatforms(): Promise<DeliveryPlatform[]>;
    getPlatformById(id: number): Promise<DeliveryPlatform>;
    getPlatformByCode(code: string): Promise<DeliveryPlatform | null>;
    createPlatform(data: PlatformCreateData): Promise<DeliveryPlatform>;
    updatePlatform(id: number, data: PlatformUpdateData): Promise<DeliveryPlatform>;
    togglePlatform(id: number): Promise<DeliveryPlatform>;
    deletePlatform(id: number): Promise<void>;
    getEnabledPlatforms(): Promise<DeliveryPlatform[]>;
    getAllDrivers(): Promise<DeliveryDriver[]>;
    getDriverById(id: number): Promise<DeliveryDriver>;
    getAvailableDrivers(): Promise<DeliveryDriver[]>;
    createDriver(data: {
        name: string;
        phone: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
    }): Promise<DeliveryDriver>;
    updateDriver(id: number, data: {
        name?: string;
        phone?: string;
        email?: string;
        vehicleType?: VehicleType;
        licensePlate?: string;
        isActive?: boolean;
    }): Promise<DeliveryDriver>;
    toggleDriverAvailability(id: number): Promise<DeliveryDriver>;
    toggleDriverActive(id: number): Promise<DeliveryDriver>;
    assignDriverToOrder(driverId: number, orderId: number): Promise<void>;
    releaseDriver(driverId: number): Promise<DeliveryDriver>;
    deleteDriver(id: number): Promise<void>;
    getDeliveryOrders(status?: string): Promise<any[]>;
}
export declare const deliveryService: DeliveryService;
export {};
//# sourceMappingURL=delivery.service.d.ts.map