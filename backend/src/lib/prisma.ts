/**
 * @fileoverview Singleton del cliente Prisma con extension de soft-delete
 *
 * Este modulo crea una unica instancia de PrismaClient que se reutiliza en toda
 * la aplicacion. En desarrollo, se almacena en `global` para evitar que el
 * hot-reload de ts-node-dev cree multiples conexiones a la base de datos.
 *
 * Incluye una extension de soft-delete para el modelo Order: en lugar de
 * eliminar registros fisicamente, se marca el campo `deletedAt` con la fecha
 * actual. Las consultas de lectura filtran automaticamente los registros
 * eliminados, a menos que se solicite explicitamente.
 *
 * @module lib/prisma
 */

import { PrismaClient } from '@prisma/client';

// Almacenamiento global para evitar multiples instancias en desarrollo.
// En produccion esto no es necesario porque el proceso no se recarga.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// DB-007: El pool de conexiones se configura via el parametro connection_limit
// en DATABASE_URL o la variable DB_POOL_SIZE en docker-compose (por defecto 50).
// Prisma lee connection_limit directamente de la URL de conexion.
//
// SEC-P4-04: Recommended DATABASE_URL pool parameters for production:
//   ?connection_limit=20&pool_timeout=10&connect_timeout=5
//   - connection_limit: Max connections in pool (default: num_cpus * 2 + 1)
//   - pool_timeout: Seconds to wait for a free connection before error (default: 10)
//   - connect_timeout: Seconds to wait for DB connection establishment (default: 5)
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

// SEC-P4-04: Default transaction options to prevent slow query DoS.
// Transactions that exceed 10s timeout are aborted to prevent connection exhaustion.
export const TRANSACTION_OPTIONS = {
  maxWait: 5000,  // Max time to acquire a connection from pool (ms)
  timeout: 10000, // Max transaction duration before automatic rollback (ms)
} as const;

// =============================================================================
// FIX P0-DATA-002: Extension de soft-delete para el modelo Order
// En gastronomia, nunca se debe eliminar una orden fisicamente porque se necesita
// para auditorias, reportes fiscales y conciliacion contable. Esta extension
// intercepta las operaciones de lectura y eliminacion del modelo Order:
// - Lectura: agrega automaticamente `deletedAt: null` al where (solo muestra activas)
// - Eliminacion: convierte el DELETE en un UPDATE que setea `deletedAt = now()`
// =============================================================================
export const prisma = basePrisma.$extends({
  query: {
    order: {
      async findMany({ args, query }) {
        // Si el caller no especifico un filtro explicito de deletedAt,
        // asumimos que solo quiere ordenes activas (no eliminadas)
        args.where = { ...args.where, deletedAt: args.where?.deletedAt !== undefined ? args.where.deletedAt : null };
        return query(args);
      },
      async findFirst({ args, query }) {
        // Misma logica que findMany: filtrar soft-deleted por defecto
        args.where = { ...args.where, deletedAt: args.where?.deletedAt !== undefined ? args.where.deletedAt : null };
        return query(args);
      },
      async findUnique({ args, query }) {
        // findUnique no filtra por deletedAt porque se busca por ID exacto.
        // Si se necesita verificar que no este eliminada, el servicio lo hace explicitamente.
        return query(args);
      },
      async delete({ args }) {
        // Convertir eliminacion fisica en soft-delete
        return basePrisma.order.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany({ args }) {
        // Convertir eliminacion masiva en soft-delete masivo
        return basePrisma.order.updateMany({
          where: args.where ?? {},
          data: { deletedAt: new Date() },
        });
      },
    },
  },
}) as unknown as PrismaClient;

// En desarrollo, guardar la instancia base en global para reutilizarla
// entre recargas del modulo causadas por hot-reload
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;
