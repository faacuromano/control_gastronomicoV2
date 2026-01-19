/**
 * @fileoverview Delivery Controller
 * Handles HTTP requests for delivery platforms and drivers
 */

import { Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

// ============================================================================
// PLATFORMS
// ============================================================================

export const getAllPlatforms = asyncHandler(async (_req: Request, res: Response) => {
    const platforms = await deliveryService.getAllPlatforms();
    sendSuccess(res, platforms);
});

export const getPlatformById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.getPlatformById(id);
    sendSuccess(res, platform);
});

export const createPlatform = asyncHandler(async (req: Request, res: Response) => {
    const platform = await deliveryService.createPlatform(req.body);
    sendSuccess(res, platform, undefined, 201);
});

export const updatePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.updatePlatform(id, req.body);
    sendSuccess(res, platform);
});

export const togglePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.togglePlatform(id);
    sendSuccess(res, platform);
});

export const deletePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deletePlatform(id);
    sendSuccess(res, { message: 'Platform deleted' });
});

// ============================================================================
// DRIVERS
// ============================================================================

export const getAllDrivers = asyncHandler(async (_req: Request, res: Response) => {
    const drivers = await deliveryService.getAllDrivers();
    sendSuccess(res, drivers);
});

export const getAvailableDrivers = asyncHandler(async (_req: Request, res: Response) => {
    const drivers = await deliveryService.getAvailableDrivers();
    sendSuccess(res, drivers);
});

export const getDriverById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.getDriverById(id);
    sendSuccess(res, driver);
});

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
    const driver = await deliveryService.createDriver(req.body);
    sendSuccess(res, driver, undefined, 201);
});

export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.updateDriver(id, req.body);
    sendSuccess(res, driver);
});

export const toggleDriverAvailability = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverAvailability(id);
    sendSuccess(res, driver);
});

export const toggleDriverActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverActive(id);
    sendSuccess(res, driver);
});

export const assignDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const driverId = parseInt(req.params.id as string);
    const { orderId } = req.body;
    await deliveryService.assignDriverToOrder(driverId, orderId);
    sendSuccess(res, { message: 'Driver assigned to order' });
});

export const releaseDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.releaseDriver(id);
    sendSuccess(res, driver);
});

export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deleteDriver(id);
    sendSuccess(res, { message: 'Driver deleted' });
});

// ============================================================================
// DELIVERY ORDERS
// ============================================================================

export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const orders = await deliveryService.getDeliveryOrders(status);
    sendSuccess(res, orders);
});

/**
 * Assign a User (with delivery role) as driver to an order.
 * This uses the driverId field (FK to User), not deliveryDriverId.
 */
export const assignUserDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const { driverId } = req.body;
    
    // Import orderDeliveryService for User driver assignment
    const { orderDeliveryService } = await import('../services/orderDelivery.service');
    const order = await orderDeliveryService.assignDriver(orderId, driverId);
    
    sendSuccess(res, order);
});
