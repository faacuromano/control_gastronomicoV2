/**
 * @fileoverview Controlador de Métodos de Pago
 *
 * CRUD para configurar los métodos de pago aceptados por el negocio
 * (efectivo, tarjeta débito, crédito, transferencia, QR, etc.).
 * Cada tenant puede personalizar qué métodos tiene habilitados,
 * su orden de aparición en el POS y su ícono representativo.
 *
 * @module controllers/paymentMethod.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { paymentMethodService, type PaymentMethodConfigInput } from '../services/paymentMethod.service';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

/** Esquema de validación para crear un método de pago */
const createSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(50),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

const updateSchema = createSchema.partial();

/**
 * Obtiene todos los métodos de pago del tenant con paginación.
 * Usado en el panel de administración para gestionar configuración.
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const { page: pageStr, limit: limitStr } = req.query;

  // Parsear parámetros de paginación
  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(Math.max(1, parseInt(limitStr as string) || 50), 100);

  const result = await paymentMethodService.getAll(req.user!.tenantId!, page, limit);

  sendSuccess(res, result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit)
  });
});

/**
 * Obtiene solo los métodos de pago activos.
 * Usado en el POS para mostrar las opciones de pago disponibles al cobrar.
 */
export const getActive = asyncHandler(async (req: Request, res: Response) => {
  const methods = await paymentMethodService.getActive(req.user!.tenantId!);
  sendSuccess(res, methods);
});

/** Obtiene un método de pago por ID */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const method = await paymentMethodService.getById(id, req.user!.tenantId!);
  sendSuccess(res, method);
});

/** Crea un nuevo método de pago para el tenant con registro de auditoría */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const method = await paymentMethodService.create(req.user!.tenantId!, data as PaymentMethodConfigInput);

  // Auditoría: registrar creación del método de pago
  auditService.log(
    AuditAction.PAYMENT_METHOD_CREATED,
    'PaymentMethodConfig',
    method.id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { code: method.code, name: method.name }
  );

  sendSuccess(res, method, undefined, 201);
});

/** Actualiza un método de pago existente con registro de auditoría */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const data = updateSchema.parse(req.body);
  const method = await paymentMethodService.update(id, req.user!.tenantId!, data as Partial<PaymentMethodConfigInput>);

  // Auditoría: registrar modificación del método de pago
  auditService.log(
    AuditAction.PAYMENT_METHOD_UPDATED,
    'PaymentMethodConfig',
    id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { updates: data }
  );

  sendSuccess(res, method);
});

/** Alterna el estado activo/inactivo de un método de pago (toggle) */
export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const method = await paymentMethodService.toggleActive(id, req.user!.tenantId!);
  sendSuccess(res, method);
});

/** Elimina un método de pago con registro de auditoría previo a la eliminación */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  // Obtener datos del método antes de eliminar para el registro de auditoría
  const method = await paymentMethodService.getById(id, req.user!.tenantId!);

  await paymentMethodService.delete(id, req.user!.tenantId!);

  // Auditoría: registrar eliminación con los datos previos
  auditService.log(
    AuditAction.PAYMENT_METHOD_DELETED,
    'PaymentMethodConfig',
    id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { code: method.code, name: method.name }
  );

  sendSuccess(res, { message: 'Método de pago eliminado' });
});

/**
 * Inicializa los métodos de pago por defecto para un tenant nuevo.
 * Crea los métodos estándar (efectivo, tarjeta, transferencia) si no existen.
 */
export const seedDefaults = asyncHandler(async (req: Request, res: Response) => {
  await paymentMethodService.seedDefaults(req.user!.tenantId!);
  sendSuccess(res, { message: 'Métodos de pago por defecto inicializados' });
});
