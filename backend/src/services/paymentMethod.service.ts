/**
 * @fileoverview Servicio de configuracion de metodos de pago por tenant.
 * Gestiona el CRUD de metodos de pago (efectivo, tarjeta, transferencia, QR)
 * que cada restaurante puede personalizar segun sus necesidades.
 * Incluye semilla de metodos por defecto para nuevos tenants.
 *
 * @module services/paymentMethod.service
 */

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
   * Obtiene todos los metodos de pago (para panel de administracion) con paginacion.
   * Incluye tanto activos como inactivos para que el admin pueda gestionarlos todos.
   */
  async getAll(tenantId: number, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.paymentMethodConfig.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit
      }),
      prisma.paymentMethodConfig.count({ where: { tenantId } })
    ]);

    return {
      data,
      total,
      page,
      limit
    };
  }

  /**
   * Obtiene solo los metodos de pago activos (para POS/checkout).
   * Esta es la consulta que usa el frontend al momento de cobrar una orden.
   */
  async getActive(tenantId: number) {
    return await prisma.paymentMethodConfig.findMany({
      where: { isActive: true, tenantId },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Obtiene un metodo de pago por su ID.
   */
  async getById(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({
      where: { id, tenantId }
    });
    if (!method) throw new NotFoundError('Payment Method');
    return method;
  }

  /**
   * Crea un nuevo metodo de pago.
   * Valida que el codigo sea unico dentro del tenant antes de crear.
   * El codigo se almacena en mayusculas para consistencia.
   */
  async create(tenantId: number, data: PaymentMethodConfigInput) {
    // Verificar unicidad del codigo dentro del tenant
    const existing = await prisma.paymentMethodConfig.findFirst({
      where: { code: data.code, tenantId }
    });
    if (existing) {
      throw new ConflictError(`Code "${data.code}" already exists`);
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
   * Actualiza un metodo de pago existente.
   * Si el codigo cambia, verifica unicidad del nuevo codigo.
   */
  async update(id: number, tenantId: number, data: Partial<PaymentMethodConfigInput>) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // Si se esta cambiando el codigo, verificar que no exista otro con el mismo codigo
    if (data.code && data.code !== method.code) {
      const existing = await prisma.paymentMethodConfig.findFirst({
        where: { code: data.code, tenantId }
      });
      if (existing) {
        throw new ConflictError(`Code "${data.code}" already exists`);
      }
    }

    // Defensa en profundidad: updateMany garantiza que tenantId este en la clausula WHERE
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
   * Alterna el estado activo/inactivo de un metodo de pago.
   * Util para habilitar o deshabilitar rapidamente un metodo sin eliminarlo.
   */
  async toggleActive(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // Defensa en profundidad: updateMany garantiza que tenantId este en la clausula WHERE
    return await prisma.paymentMethodConfig.updateMany({
      where: { id, tenantId },
      data: { isActive: !method.isActive }
    });
  }

  /**
   * Elimina un metodo de pago.
   * NOTA: Podria agregarse validacion de que no existan pagos usando este metodo.
   */
  async delete(id: number, tenantId: number) {
    const method = await prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
    if (!method) throw new NotFoundError('Payment Method');

    // Defensa en profundidad: deleteMany garantiza que tenantId este en la clausula WHERE
    await prisma.paymentMethodConfig.deleteMany({ where: { id, tenantId } });
  }

  /**
   * Siembra los metodos de pago por defecto para un nuevo tenant.
   * Se ejecuta durante el registro de un nuevo restaurante para que tenga
   * los metodos basicos configurados de entrada (efectivo, tarjeta, transferencia, QR).
   * Usa upsert para ser idempotente en caso de re-ejecucion.
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
