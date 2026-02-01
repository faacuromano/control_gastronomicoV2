import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

// =============================================================================
// FIX P0-DATA-002: Soft-delete extension for Order model
// Automatically filters out soft-deleted orders on read queries
// and converts delete operations to soft-delete (set deletedAt)
// =============================================================================
export const prisma = basePrisma.$extends({
  query: {
    order: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: args.where?.deletedAt !== undefined ? args.where.deletedAt : null };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { ...args.where, deletedAt: args.where?.deletedAt !== undefined ? args.where.deletedAt : null };
        return query(args);
      },
      async findUnique({ args, query }) {
        return query(args);
      },
      async delete({ args }) {
        // Convert hard delete to soft delete
        return basePrisma.order.update({
          where: args.where,
          data: { deletedAt: new Date() },
        }) as any;
      },
      async deleteMany({ args }) {
        // Convert hard deleteMany to soft delete
        return basePrisma.order.updateMany({
          where: args.where ?? {},
          data: { deletedAt: new Date() },
        }) as any;
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;
