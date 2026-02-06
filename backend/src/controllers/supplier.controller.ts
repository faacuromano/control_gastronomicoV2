/**
 * @fileoverview Controlador de Proveedores
 *
 * CRUD para los proveedores de ingredientes del restaurante.
 * Los proveedores se vinculan a las órdenes de compra para trackear
 * de dónde se adquieren los insumos y mantener un directorio de contactos.
 *
 * Todas las operaciones se auditan para trazabilidad.
 *
 * @module controllers/supplier.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { supplierService } from '../services/supplier.service';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

/**
 * Esquema de validación para crear/actualizar un proveedor.
 * SEC-023: Límites de longitud en campos de texto para prevenir abuso.
 */
const supplierSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(30).optional()
});

/** Obtiene todos los proveedores del tenant con paginación */
export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 200), 200);
  const result = await supplierService.getAll(req.user!.tenantId!, page, limit);
  sendSuccess(res, result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit)
  });
});

/** Obtiene un proveedor por ID verificando pertenencia al tenant */
export const getSupplierById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const supplier = await supplierService.getById(id, req.user!.tenantId!);
  sendSuccess(res, supplier);
});

/** Crea un nuevo proveedor con registro de auditoría */
export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const parsed = supplierSchema.parse(req.body);
  const supplier = await supplierService.create(req.user!.tenantId!, parsed);

  // Auditoría: registrar creación del proveedor
  auditService.log(
    AuditAction.SUPPLIER_CREATED,
    'Supplier',
    supplier.id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { name: supplier.name, email: supplier.email, phone: supplier.phone }
  );

  sendSuccess(res, supplier, undefined, 201);
});

/** Actualiza un proveedor existente con registro de auditoría */
export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const parsed = supplierSchema.partial().parse(req.body);
  const supplier = await supplierService.update(id, req.user!.tenantId!, parsed);

  // Auditoría: registrar modificación del proveedor
  auditService.log(
    AuditAction.SUPPLIER_UPDATED,
    'Supplier',
    id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { updates: parsed }
  );

  sendSuccess(res, supplier);
});

/** Elimina un proveedor (soft-delete) con registro de auditoría previo a la eliminación */
export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  // Obtener datos del proveedor antes de eliminar para el registro de auditoría
  const supplier = await supplierService.getById(id, req.user!.tenantId!);

  await supplierService.delete(id, req.user!.tenantId!);

  // Auditoría: registrar eliminación con los datos previos
  auditService.log(
    AuditAction.SUPPLIER_DELETED,
    'Supplier',
    id,
    {
      userId: req.user!.id!,
      tenantId: req.user!.tenantId!,
      ipAddress: String(req.ip),
      userAgent: req.headers['user-agent'] ?? 'unknown'
    },
    { supplierName: supplier.name }
  );

  sendSuccess(res, { message: 'Proveedor eliminado exitosamente' });
});
