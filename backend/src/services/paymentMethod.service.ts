import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export interface PaymentMethodConfigInput {
  code: string;
  name: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export class PaymentMethodService {
  /**
   * Get all payment methods (for admin)
   */
  async getAll(tenantId: number) {
    return await prisma.paymentMethodConfig.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Get only active payment methods (for POS/checkout)
   */
  async getActive(tenantId: number) {
    return await prisma.paymentMethodConfig.findMany({
      where: { isActive: true, tenantId },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Get by ID
   */
  async getById(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({
      where: { id, tenantId }
    });
    if (!method) throw new NotFoundError('Payment Method');
    return method;
  }

  /**
   * Create new payment method
   */
  async create(tenantId: number, data: PaymentMethodConfigInput) {
    // Check unique code
    const existing = await prisma.paymentMethodConfig.findFirst({
      where: { code: data.code, tenantId }
    });
    if (existing) {
      throw new ConflictError(`El código "${data.code}" ya existe`);
    }

    return await prisma.paymentMethodConfig.create({
      data: {
        tenantId,
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
  async update(id: number, tenantId: number, data: Partial<PaymentMethodConfigInput>) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // If code is changing, check uniqueness
    if (data.code && data.code !== method.code) {
      const existing = await prisma.paymentMethodConfig.findFirst({
        where: { code: data.code, tenantId }
      });
      if (existing) {
        throw new ConflictError(`El código "${data.code}" ya existe`);
      }
    }

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.paymentMethodConfig.updateMany({
      where: { id, tenantId },
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
  async toggleActive(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // defense-in-depth: updateMany ensures tenantId is in the WHERE clause
    return await prisma.paymentMethodConfig.updateMany({
      where: { id, tenantId },
      data: { isActive: !method.isActive }
    });
  }

  /**
   * Delete payment method
   */
  async delete(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // Could add check for existing payments using this method
    
    // defense-in-depth: deleteMany ensures tenantId is in the WHERE clause
    await prisma.paymentMethodConfig.deleteMany({ where: { id, tenantId } });
  }

  /**
   * Seed default payment methods
   */
  async seedDefaults(tenantId: number) {
    const defaults = [
      { code: 'CASH', name: 'Efectivo', icon: 'Banknote', sortOrder: 1 },
      { code: 'CARD', name: 'Tarjeta', icon: 'CreditCard', sortOrder: 2 },
      { code: 'TRANSFER', name: 'Transferencia', icon: 'ArrowRightLeft', sortOrder: 3 },
      { code: 'QR_INTEGRATED', name: 'QR Mercado Pago', icon: 'QrCode', sortOrder: 4 }
    ];

    for (const method of defaults) {
      await prisma.paymentMethodConfig.upsert({
        where: {
            tenantId_code: {
                tenantId,
                code: method.code
            }
        },
        update: {},
        create: {
            ...method,
            tenantId
        }
      });
    }
  }
}

export const paymentMethodService = new PaymentMethodService();
