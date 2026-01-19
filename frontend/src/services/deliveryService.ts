/**
 * @fileoverview Delivery Service (Frontend)
 * Client-side service for delivery management
 */

import api from '../lib/api';

export interface DeliveryPlatform {
    id: number;
    code: string;
    name: string;
    isEnabled: boolean;
    apiKey?: string;
    webhookSecret?: string;
    storeId?: string;
    menuSyncEnabled: boolean;
    lastSyncAt?: string;
    commissionRate?: number;
    config?: any;
    createdAt: string;
    updatedAt: string;
}

export interface DeliveryDriver {
    id: number;
    name: string;
    phone: string;
    email?: string;
    vehicleType: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
    licensePlate?: string;
    isActive: boolean;
    isAvailable: boolean;
    currentOrderId?: number;
    createdAt: string;
    updatedAt: string;
}

class DeliveryService {
    // ========================================================================
    // PLATFORMS
    // ========================================================================

    async getAllPlatforms(): Promise<DeliveryPlatform[]> {
        const response = await api.get('/delivery/platforms');
        return response.data.data;
    }

    async getPlatformById(id: number): Promise<DeliveryPlatform> {
        const response = await api.get(`/delivery/platforms/${id}`);
        return response.data.data;
    }

    async createPlatform(data: {
        code: string;
        name: string;
        apiKey?: string;
        webhookSecret?: string;
        storeId?: string;
        commissionRate?: number;
    }): Promise<DeliveryPlatform> {
        const response = await api.post('/delivery/platforms', data);
        return response.data.data;
    }

    async updatePlatform(id: number, data: Partial<DeliveryPlatform>): Promise<DeliveryPlatform> {
        const response = await api.patch(`/delivery/platforms/${id}`, data);
        return response.data.data;
    }

    async togglePlatform(id: number): Promise<DeliveryPlatform> {
        const response = await api.patch(`/delivery/platforms/${id}/toggle`);
        return response.data.data;
    }

    async deletePlatform(id: number): Promise<void> {
        await api.delete(`/delivery/platforms/${id}`);
    }

    // ========================================================================
    // DRIVERS
    // ========================================================================

    async getAllDrivers(): Promise<DeliveryDriver[]> {
        const response = await api.get('/delivery/drivers');
        return response.data.data;
    }

    async getAvailableDrivers(): Promise<DeliveryDriver[]> {
        const response = await api.get('/delivery/drivers/available');
        return response.data.data;
    }

    async getDriverById(id: number): Promise<DeliveryDriver> {
        const response = await api.get(`/delivery/drivers/${id}`);
        return response.data.data;
    }

    async createDriver(data: {
        name: string;
        phone: string;
        email?: string;
        vehicleType?: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
        licensePlate?: string;
    }): Promise<DeliveryDriver> {
        const response = await api.post('/delivery/drivers', data);
        return response.data.data;
    }

    async updateDriver(id: number, data: Partial<DeliveryDriver>): Promise<DeliveryDriver> {
        const response = await api.patch(`/delivery/drivers/${id}`, data);
        return response.data.data;
    }

    async toggleDriverAvailability(id: number): Promise<DeliveryDriver> {
        const response = await api.patch(`/delivery/drivers/${id}/availability`);
        return response.data.data;
    }

    async toggleDriverActive(id: number): Promise<DeliveryDriver> {
        const response = await api.patch(`/delivery/drivers/${id}/active`);
        return response.data.data;
    }

    async assignDriverToOrder(driverId: number, orderId: number): Promise<void> {
        await api.post(`/delivery/drivers/${driverId}/assign`, { orderId });
    }

    async releaseDriver(driverId: number): Promise<DeliveryDriver> {
        const response = await api.post(`/delivery/drivers/${driverId}/release`);
        return response.data.data;
    }

    async deleteDriver(id: number): Promise<void> {
        await api.delete(`/delivery/drivers/${id}`);
    }

    // ========================================================================
    // DELIVERY ORDERS
    // ========================================================================

    async getDeliveryOrders(status?: string): Promise<any[]> {
        const params = status ? `?status=${status}` : '';
        const response = await api.get(`/delivery/orders${params}`);
        return response.data.data;
    }
}

export const deliveryService = new DeliveryService();
