"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getSupplierById = exports.getSuppliers = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const supplier_service_1 = require("../services/supplier.service");
/**
 * Zod schema for supplier creation/update
 */
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional()
});
/**
 * Get all suppliers
 */
exports.getSuppliers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const suppliers = await supplier_service_1.supplierService.getAll();
    res.json({ success: true, data: suppliers });
});
/**
 * Get supplier by ID
 */
exports.getSupplierById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const supplier = await supplier_service_1.supplierService.getById(id);
    res.json({ success: true, data: supplier });
});
/**
 * Create new supplier
 */
exports.createSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const parsed = supplierSchema.parse(req.body);
    // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
    const supplier = await supplier_service_1.supplierService.create(parsed);
    res.status(201).json({ success: true, data: supplier });
});
/**
 * Update supplier
 */
exports.updateSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const parsed = supplierSchema.partial().parse(req.body);
    // Type assertion needed due to Prisma exactOptionalPropertyTypes incompatibility
    const supplier = await supplier_service_1.supplierService.update(id, parsed);
    res.json({ success: true, data: supplier });
});
/**
 * Delete supplier (soft delete)
 */
exports.deleteSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await supplier_service_1.supplierService.delete(id);
    res.json({ success: true, message: 'Proveedor eliminado correctamente' });
});
//# sourceMappingURL=supplier.controller.js.map