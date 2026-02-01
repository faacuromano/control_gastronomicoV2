import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class ClientService {
  /**
   * Search clients by name or phone, or return recent clients.
   */
  async search(tenantId: number, query?: string, page = 1, limit = 50) {
    // PERF-008: Support pagination (default 50, max 200)
    const take = Math.min(Math.max(1, limit), 200);
    const skip = (Math.max(1, page) - 1) * take;

    const where: any = { tenantId };
    if (query && query.trim()) {
      where.OR = [
        { name: { contains: query } },
        { phone: { contains: query } }
      ];
    }

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        take,
        skip,
        orderBy: { id: 'desc' }
      }),
      prisma.client.count({ where })
    ]);

    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  /**
   * Create a new client. If a client with the same phone exists,
   * update their name/address instead (POS convenience).
   * Returns { client, created } to indicate if a new record was made.
   */
  async createOrUpdate(
    tenantId: number,
    data: { name: string; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }
  ) {
    // Check if phone exists (scoped to tenant)
    if (data.phone) {
      const existing = await prisma.client.findFirst({
        where: { phone: data.phone, tenantId }
      });

      if (existing) {
        const result = await prisma.client.updateMany({
          where: { id: existing.id, tenantId },
          data: {
            address: data.address || existing.address,
            name: data.name
          }
        });

        if (result.count === 0) {
          return { client: null, created: false };
        }

        const updated = await prisma.client.findFirst({
          where: { id: existing.id, tenantId }
        });
        return { client: updated, created: false };
      }
    }

    const client = await prisma.client.create({
      data: {
        tenantId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        taxId: data.taxId || null
      } as Prisma.ClientUncheckedCreateInput
    });

    return { client, created: true };
  }
}

export const clientService = new ClientService();
