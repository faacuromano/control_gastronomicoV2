/**
 * @fileoverview Controlador de Delivery
 *
 * Gestiona las plataformas de delivery (PedidosYa, Rappi, etc.), los repartidores
 * propios del negocio y las órdenes de delivery. Soporta tanto delivery propio
 * (con repartidores del restaurante) como plataformas externas.
 *
 * Estructura del módulo:
 * - PLATAFORMAS: CRUD de configuración de plataformas de delivery por tenant
 * - REPARTIDORES: CRUD y gestión de disponibilidad de repartidores propios
 * - ORDENES DELIVERY: Consulta y asignación de repartidores a órdenes
 *
 * @module controllers/delivery.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { VehicleType } from '@prisma/client';
import { deliveryService, PlatformCreateData, PlatformUpdateData, DriverCreateData, DriverUpdateData } from '../services/delivery.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

/** Esquema para crear una plataforma de delivery con credenciales de API */
const createPlatformSchema = z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(100),
    apiKey: z.string().max(500).optional(),
    webhookSecret: z.string().max(500).optional(),
    storeId: z.string().max(100).optional()
});

const updatePlatformSchema = createPlatformSchema.partial();

/** Esquema para crear un repartidor propio del negocio */
const createDriverSchema = z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(1).max(30),
    email: z.string().email().max(254).optional(),
    vehicleType: z.nativeEnum(VehicleType).optional(),
    licensePlate: z.string().max(20).optional()
});

const updateDriverSchema = createDriverSchema.partial();

/** Esquema para asignar un repartidor (DeliveryDriver) a una orden */
const assignDriverToOrderSchema = z.object({
    orderId: z.number().int().positive()
});

/** Esquema para asignar un usuario con rol de repartidor a una orden */
const assignUserDriverSchema = z.object({
    driverId: z.number().int().positive()
});

// ============================================================================
// PLATAFORMAS DE DELIVERY
// ============================================================================

/**
 * Elimina credenciales sensibles (apiKey, webhookSecret) antes de enviar al frontend.
 * SEC-038: Las credenciales de API nunca se exponen en respuestas.
 */
function sanitizePlatform<T extends Record<string, unknown>>(platform: T): Omit<T, 'apiKey' | 'webhookSecret'> {
    const { apiKey, webhookSecret, ...safe } = platform;
    return safe as Omit<T, 'apiKey' | 'webhookSecret'>;
}

/** Obtiene todas las plataformas de delivery configuradas para el tenant */
export const getAllPlatforms = asyncHandler(async (req: Request, res: Response) => {
    const platforms = await deliveryService.getAllPlatforms(req.user!.tenantId!);
    sendSuccess(res, platforms.map(sanitizePlatform));
});

/** Obtiene una plataforma por ID con credenciales sanitizadas */
export const getPlatformById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.getPlatformById(id, req.user!.tenantId!);
    sendSuccess(res, sanitizePlatform(platform));
});

/**
 * Crea una nueva configuración de plataforma de delivery para el tenant.
 * FIX P0-SEC-001: Todo el CRUD de plataformas está aislado por tenantId del usuario autenticado.
 */
export const createPlatform = asyncHandler(async (req: Request, res: Response) => {
    const data = createPlatformSchema.parse(req.body);
    const platform = await deliveryService.createPlatform(req.user!.tenantId!, data as PlatformCreateData);
    sendSuccess(res, platform, undefined, 201);
});

/** Actualiza la configuración de una plataforma de delivery */
export const updatePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const data = updatePlatformSchema.parse(req.body);
    const platform = await deliveryService.updatePlatform(id, req.user!.tenantId!, data as PlatformUpdateData);
    sendSuccess(res, platform);
});

/** Activa/desactiva una plataforma de delivery (toggle) */
export const togglePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const platform = await deliveryService.togglePlatform(id, req.user!.tenantId!);
    sendSuccess(res, platform);
});

/** Elimina una plataforma de delivery del tenant */
export const deletePlatform = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deletePlatform(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Platform deleted' });
});

// ============================================================================
// REPARTIDORES PROPIOS
// ============================================================================

/** Obtiene todos los repartidores del tenant */
export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await deliveryService.getAllDrivers(req.user!.tenantId!);
    sendSuccess(res, drivers);
});

/** Obtiene solo los repartidores activos y disponibles para asignar */
export const getAvailableDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await deliveryService.getAvailableDrivers(req.user!.tenantId!);
    sendSuccess(res, drivers);
});

/** Obtiene un repartidor por ID */
export const getDriverById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.getDriverById(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

/** Crea un nuevo repartidor para el tenant */
export const createDriver = asyncHandler(async (req: Request, res: Response) => {
    const data = createDriverSchema.parse(req.body);
    const driver = await deliveryService.createDriver(req.user!.tenantId!, data as DriverCreateData);
    sendSuccess(res, driver, undefined, 201);
});

/** Actualiza los datos de un repartidor */
export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const data = updateDriverSchema.parse(req.body);
    const driver = await deliveryService.updateDriver(id, req.user!.tenantId!, data as DriverUpdateData);
    sendSuccess(res, driver);
});

/** Alterna la disponibilidad de un repartidor (disponible/no disponible) */
export const toggleDriverAvailability = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverAvailability(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

/** Activa/desactiva un repartidor (toggle de estado activo) */
export const toggleDriverActive = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.toggleDriverActive(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

/** Asigna un repartidor (DeliveryDriver) a una orden de delivery */
export const assignDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const driverId = parseInt(req.params.id as string);
    const { orderId } = assignDriverToOrderSchema.parse(req.body);
    await deliveryService.assignDriverToOrder(driverId, orderId, req.user!.tenantId!);
    sendSuccess(res, { message: 'Driver assigned to order' });
});

/** Libera un repartidor de su orden actual (lo marca como disponible nuevamente) */
export const releaseDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const driver = await deliveryService.releaseDriver(id, req.user!.tenantId!);
    sendSuccess(res, driver);
});

/** Elimina un repartidor del tenant */
export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    await deliveryService.deleteDriver(id, req.user!.tenantId!);
    sendSuccess(res, { message: 'Driver deleted' });
});

// ============================================================================
// ORDENES DE DELIVERY
// ============================================================================

/** Obtiene las órdenes de delivery, opcionalmente filtradas por estado */
export const getDeliveryOrders = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const orders = await deliveryService.getDeliveryOrders(req.user!.tenantId!, status);
    sendSuccess(res, orders);
});

/**
 * Asigna un usuario (con rol de repartidor) como driver de una orden.
 * A diferencia de assignDriverToOrder que usa DeliveryDriver, este usa el campo
 * driverId (FK a User) del modelo Order para repartidores que son empleados del local.
 */
export const assignUserDriverToOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const { driverId } = assignUserDriverSchema.parse(req.body);

    // Importar orderDeliveryService para asignación de usuario como repartidor
    const { orderDeliveryService } = await import('../services/orderDelivery.service');
    const order = await orderDeliveryService.assignDriver(orderId, driverId, req.user!.tenantId!);

    sendSuccess(res, order);
});
