"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentMethodService = exports.PaymentMethodService = void 0;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
class PaymentMethodService {
    /**
     * Get all payment methods (for admin)
     */
    async getAll() {
        return await prisma_1.prisma.paymentMethodConfig.findMany({
            orderBy: { sortOrder: 'asc' }
        });
    }
    /**
     * Get only active payment methods (for POS/checkout)
     */
    async getActive() {
        return await prisma_1.prisma.paymentMethodConfig.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
        });
    }
    /**
     * Get by ID
     */
    async getById(id) {
        const method = await prisma_1.prisma.paymentMethodConfig.findUnique({
            where: { id }
        });
        if (!method)
            throw new errors_1.NotFoundError('Payment Method');
        return method;
    }
    /**
     * Create new payment method
     */
    async create(data) {
        // Check unique code
        const existing = await prisma_1.prisma.paymentMethodConfig.findUnique({
            where: { code: data.code }
        });
        if (existing) {
            throw new errors_1.ConflictError(`El código "${data.code}" ya existe`);
        }
        return await prisma_1.prisma.paymentMethodConfig.create({
            data: {
                code: data.code.toUpperCase(),
                name: data.name,
                icon: data.icon ?? null,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder ?? 0
            }
        });
    }
    /**
     * Update payment method
     */
    async update(id, data) {
        const method = await prisma_1.prisma.paymentMethodConfig.findUnique({ where: { id } });
        if (!method)
            throw new errors_1.NotFoundError('Payment Method');
        // If code is changing, check uniqueness
        if (data.code && data.code !== method.code) {
            const existing = await prisma_1.prisma.paymentMethodConfig.findUnique({
                where: { code: data.code }
            });
            if (existing) {
                throw new errors_1.ConflictError(`El código "${data.code}" ya existe`);
            }
        }
        return await prisma_1.prisma.paymentMethodConfig.update({
            where: { id },
            data: {
                ...(data.code && { code: data.code.toUpperCase() }),
                ...(data.name && { name: data.name }),
                ...(data.icon !== undefined && { icon: data.icon }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder })
            }
        });
    }
    /**
     * Toggle active status
     */
    async toggleActive(id) {
        const method = await prisma_1.prisma.paymentMethodConfig.findUnique({ where: { id } });
        if (!method)
            throw new errors_1.NotFoundError('Payment Method');
        return await prisma_1.prisma.paymentMethodConfig.update({
            where: { id },
            data: { isActive: !method.isActive }
        });
    }
    /**
     * Delete payment method
     */
    async delete(id) {
        const method = await prisma_1.prisma.paymentMethodConfig.findUnique({ where: { id } });
        if (!method)
            throw new errors_1.NotFoundError('Payment Method');
        // Could add check for existing payments using this method
        await prisma_1.prisma.paymentMethodConfig.delete({ where: { id } });
    }
    /**
     * Seed default payment methods
     */
    async seedDefaults() {
        const defaults = [
            { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1 },
            { code: 'CARD', name: 'Tarjeta', icon: 'CreditCard', sortOrder: 2 },
            { code: 'TRANSFER', name: 'Transferencia', icon: 'ArrowRightLeft', sortOrder: 3 },
            { code: 'QR_INTEGRATED', name: 'QR Mercado Pago', icon: 'QrCode', sortOrder: 4 }
        ];
        for (const method of defaults) {
            await prisma_1.prisma.paymentMethodConfig.upsert({
                where: { code: method.code },
                update: {},
                create: method
            });
        }
    }
}
exports.PaymentMethodService = PaymentMethodService;
exports.paymentMethodService = new PaymentMethodService();
//# sourceMappingURL=paymentMethod.service.js.map