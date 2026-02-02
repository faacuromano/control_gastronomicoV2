import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, AuditAction } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { supplierService } from '../services/supplier.service';
import { auditService } from '../services/audit.service';

/**
 * Zod schema for supplier creation/update
 */
// SEC-023: Max length validation on all text fields
const supplierSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(30).optional()
});

/**
 * Get all suppliers
 */
export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, parseInt(req.query.limit as string) || 200);
  const result = await supplierService.getAll(req.user!.tenantId!, page, limit);
  res.json({ success: true, ...result });
});

/**
 * Get supplier by ID
 */
export const getSupplierById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const supplier = await supplierService.getById(id, req.user!.tenantId!);
  res.json({ success: true, data: supplier });
});

/**
 * Create new supplier
 */
export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const parsed = supplierSchema.parse(req.body);
  // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
  const supplier = await supplierService.create(req.user!.tenantId!, parsed as Prisma.SupplierCreateInput);

  // Audit log - after successful creation
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

  res.status(201).json({ success: true, data: supplier });
});

/**
 * Update supplier
 */
export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const parsed = supplierSchema.partial().parse(req.body);
  // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
  const supplier = await supplierService.update(id, req.user!.tenantId!, parsed as Prisma.SupplierUpdateInput);

  // Audit log - after successful update
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

  res.json({ success: true, data: supplier });
});

/**
 * Delete supplier (soft delete)
 */
export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  // Get supplier details before deletion for audit log
  const supplier = await supplierService.getById(id, req.user!.tenantId!);

  await supplierService.delete(id, req.user!.tenantId!);

  // Audit log - after successful deletion
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

  res.json({ success: true, message: 'Proveedor eliminado correctamente' });
});
