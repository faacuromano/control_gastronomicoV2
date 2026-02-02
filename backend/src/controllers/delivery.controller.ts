/**
 * @fileoverview Delivery Controller
 * Handles HTTP requests for delivery platforms and drivers
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { VehicleType } from '@prisma/client';
import { deliveryService, PlatformCreateData, PlatformUpdateData, DriverCreateData, DriverUpdateData } from '../services/delivery.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

const createPlatformSchema = z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(100),
    apiKey: z.string().max(500).optional(),
    webhookSecret: z.string().max(500).optional(),
    storeId: z.string().max(100).optional()
});

const updatePlatformSchema = createPlatformSchema.partial();

const createDriverSchema = z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(1).max(30),
    email: z.string().email().max(254).optional(),
    vehicleType: z.nativeEnum(VehicleType).optional(),
    licensePlate: z.string().max(20).optional()
});

const updateDriverSchema = createDriverSchema.partial();

const assignDriverToOrderSchema = z.object({
    orderId: z.number().int().positive()
});

const assignUserDriverSchema = z.object({
    driverId: z.number().int().positive()
});

// ============================================================================
// PLATFORMS
// ============================================================================

export const getAllPlatforms = asyncHandler(async (req: Request, res: Response) => {
    const platforms = await deliveryService.getAllPlatforms(req.user!.tenantId!);
    sendSuccess(res, platforms);
});

export const getPlatformById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.getPlatformById(id, req.user!.tenantId!);
    sendSuccess(res, platform);
});

// FIX P0-SEC-001: All platform CRUD scoped by tenantId from authenticated user
export const createPlatform = asyncHandler(async (req: Request, res: Response) => {
    const data = createPlatformSchema.parse(req.body);
    const platform = await deliveryService.createPlatform(req.user!.tenantId!, data as PlatformCreateData);
    sendSuccess(res, platform, undefined, 201);
});

export const updatePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const data = updatePlatformSchema.parse(req.body);
    const platform = await deliveryService.updatePlatform(id, req.user!.tenantId!, data as PlatformUpdateData);
    sendSuccess(res, platform);
});

export const togglePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.togglePlatform(id, req.user!.tenantId!);
    sendSuccess(res, platform);
});

export const deletePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deletePlatform(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Platform deleted' });
});

// ============================================================================
// DRIVERS
// ============================================================================

export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await deliveryService.getAllDrivers(req.user!.tenantId!);
    sendSuccess(res, drivers);
});

export const getAvailableDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await deliveryService.getAvailableDrivers(req.user!.tenantId!);
    sendSuccess(res, drivers);
});

export const getDriverById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.getDriverById(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
    const data = createDriverSchema.parse(req.body);
    const driver = await deliveryService.createDriver(req.user!.tenantId!, data as DriverCreateData);
    sendSuccess(res, driver, undefined, 201);
});

export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const data = updateDriverSchema.parse(req.body);
    const driver = await deliveryService.updateDriver(id, req.user!.tenantId!, data as DriverUpdateData);
    sendSuccess(res, driver);
});

export const toggleDriverAvailability = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverAvailability(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

export const toggleDriverActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverActive(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

export const assignDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const driverId = parseInt(req.params.id as string);
    const { orderId } = assignDriverToOrderSchema.parse(req.body);
    await deliveryService.assignDriverToOrder(driverId, orderId, req.user!.tenantId!);
    sendSuccess(res, { message: 'Driver assigned to order' });
});

export const releaseDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.releaseDriver(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deleteDriver(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Driver deleted' });
});

// ============================================================================
// DELIVERY ORDERS
// ============================================================================

export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const orders = await deliveryService.getDeliveryOrders(req.user!.tenantId!, status);
    sendSuccess(res, orders);
});

/**
 * Assign a User (with delivery role) as driver to an order.
 * This uses the driverId field (FK to User), not deliveryDriverId.
 */
export const assignUserDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const { driverId } = assignUserDriverSchema.parse(req.body);

    // Import orderDeliveryService for User driver assignment
    const { orderDeliveryService } = await import('../services/orderDelivery.service');
    const order = await orderDeliveryService.assignDriver(orderId, driverId, req.user!.tenantId!);
    
    sendSuccess(res, order);
});
