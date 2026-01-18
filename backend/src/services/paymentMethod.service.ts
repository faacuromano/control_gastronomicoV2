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
  async getAll() {
    return await prisma.paymentMethodConfig.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Get only active payment methods (for POS/checkout)
   */
  async getActive() {
    return await prisma.paymentMethodConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Get by ID
   */
  async getById(id: number) {
    const method = await prisma.paymentMethodConfig.findUnique({
      where: { id }
    });
    if (!method) throw new NotFoundError('Payment Method');
    return method;
  }

  /**
   * Create new payment method
   */
  async create(data: PaymentMethodConfigInput) {
    // Check unique code
    const existing = await prisma.paymentMethodConfig.findUnique({
      where: { code: data.code }
    });
    if (existing) {
      throw new ConflictError(`El código "${data.code}" ya existe`);
    }

    return await prisma.paymentMethodConfig.create({
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
  async update(id: number, data: Partial<PaymentMethodConfigInput>) {
    const method = await prisma.paymentMethodConfig.findUnique({ where: { id } });
    if (!method) throw new NotFoundError('Payment Method');

    // If code is changing, check uniqueness
    if (data.code && data.code !== method.code) {
      const existing = await prisma.paymentMethodConfig.findUnique({
        where: { code: data.code }
      });
      if (existing) {
        throw new ConflictError(`El código "${data.code}" ya existe`);
      }
    }

    return await prisma.paymentMethodConfig.update({
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
  async toggleActive(id: number) {
    const method = await prisma.paymentMethodConfig.findUnique({ where: { id } });
    if (!method) throw new NotFoundError('Payment Method');

    return await prisma.paymentMethodConfig.update({
      where: { id },
      data: { isActive: !method.isActive }
    });
  }

  /**
   * Delete payment method
   */
  async delete(id: number) {
    const method = await prisma.paymentMethodConfig.findUnique({ where: { id } });
    if (!method) throw new NotFoundError('Payment Method');

    // Could add check for existing payments using this method
    
    await prisma.paymentMethodConfig.delete({ where: { id } });
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
      await prisma.paymentMethodConfig.upsert({
        where: { code: method.code },
        update: {},
        create: method
      });
    }
  }
}

export const paymentMethodService = new PaymentMethodService();
