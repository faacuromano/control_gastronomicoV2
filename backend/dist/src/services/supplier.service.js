"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierService = exports.SupplierService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
class SupplierService {
    /**
     * Get all active suppliers
     */
    async getAll() {
        return await prisma_1.prisma.supplier.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
    }
    /**
     * Get supplier by ID
     */
    async getById(id) {
        const supplier = await prisma_1.prisma.supplier.findUnique({
            where: { id }
        });
        if (!supplier)
            throw new errors_1.NotFoundError('Supplier');
        return supplier;
    }
    /**
     * Create new supplier
     */
    async create(data) {
        // Validate unique name
        const existing = await prisma_1.prisma.supplier.findFirst({
            where: {
                name: data.name,
                isActive: true
            }
        });
        if (existing) {
            throw new errors_1.ConflictError('Ya existe un proveedor activo con ese nombre');
        }
        return await prisma_1.prisma.supplier.create({
            data
        });
    }
    /**
     * Update supplier
     */
    async update(id, data) {
        const supplier = await prisma_1.prisma.supplier.findUnique({
            where: { id }
        });
        if (!supplier) {
            throw new errors_1.NotFoundError('Supplier');
        }
        // If updating name, check uniqueness
        if (data.name && typeof data.name === 'string' && data.name !== supplier.name) {
            const existing = await prisma_1.prisma.supplier.findFirst({
                where: {
                    name: data.name,
                    isActive: true,
                    id: { not: id }
                }
            });
            if (existing) {
                throw new errors_1.ConflictError('Ya existe un proveedor con ese nombre');
            }
        }
        return await prisma_1.prisma.supplier.update({
            where: { id },
            data
        });
    }
    /**
     * Soft delete supplier
     * Validates that supplier has no purchase orders
     */
    async delete(id) {
        const supplier = await prisma_1.prisma.supplier.findUnique({
            where: { id }
        });
        if (!supplier) {
            throw new errors_1.NotFoundError('Supplier');
        }
        // Check if has purchase orders
        const ordersCount = await prisma_1.prisma.purchaseOrder.count({
            where: { supplierId: id }
        });
        if (ordersCount > 0) {
            throw new errors_1.ConflictError(`No se puede eliminar: el proveedor tiene ${ordersCount} órdenes de compra`);
        }
        // Soft delete
        return await prisma_1.prisma.supplier.update({
            where: { id },
            data: { isActive: false }
        });
    }
}
exports.SupplierService = SupplierService;
exports.supplierService = new SupplierService();
//# sourceMappingURL=supplier.service.js.map