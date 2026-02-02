/**
 * @fileoverview Servicio de clientes del restaurante.
 *
 * Gestiona la búsqueda y creación/actualización de clientes. Implementa un patrón
 * "upsert por teléfono" para conveniencia del POS: si ya existe un cliente con ese
 * teléfono en el tenant, actualiza sus datos en vez de crear un duplicado.
 *
 * Soporta paginación para manejar grandes bases de clientes de forma eficiente.
 *
 * @module services/client.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class ClientService {
  /**
   * Busca clientes por nombre o teléfono, o retorna los más recientes si no hay query.
   * PERF-008: Soporta paginación (default 50, máximo 200 por página).
   */
  async search(tenantId: number, query?: string, page = 1, limit = 50) {
    // PERF-008: Limitar tamaño de página para evitar consultas excesivas
    const take = Math.min(Math.max(1, limit), 200);
    const skip = (Math.max(1, page) - 1) * take;

    const where: Prisma.ClientWhereInput = { tenantId };
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
   * Crea un nuevo cliente o actualiza uno existente si ya hay un cliente con el mismo teléfono.
   * Este patrón "upsert por teléfono" es una conveniencia del POS para evitar duplicados
   * cuando el cajero ingresa un cliente recurrente.
   * Retorna { client, created } para indicar si se creó un registro nuevo o se actualizó.
   */
  async createOrUpdate(
    tenantId: number,
    data: { name: string; phone?: string | undefined; email?: string | undefined; address?: string | undefined; taxId?: string | undefined }
  ) {
    // Verificar si ya existe un cliente con ese teléfono (aislado por tenant)
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
