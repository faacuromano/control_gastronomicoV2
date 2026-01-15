import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const createClientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional()
});

export const searchClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    // If no query, return recent clients (e.g. last 20)
    if (!q || typeof q !== 'string' || !q.trim()) {
      const recentClients = await prisma.client.findMany({
          take: 20,
          orderBy: { id: 'desc' }
      });
      return res.json(recentClients);
    }

    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q } }, 
          { phone: { contains: q } }
        ]
      },
      take: 20
    });

    res.json(clients);
  } catch (error) {
    next(error);
  }
};

export const createClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createClientSchema.parse(req.body);
    
    // Check if phone exists
    if (data.phone) {
        const existing = await prisma.client.findUnique({ where: { phone: data.phone } });
        if (existing) {
             // Update existing? Or throw?
             // For POS convenience, let's update address if provided
             const updated = await prisma.client.update({
                 where: { id: existing.id },
                 data: { 
                     address: data.address || existing.address,
                     name: data.name // Update name if changed?
                 }
             });
             return res.json(updated);
        }
    }

    const client = await prisma.client.create({
      data: {
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          taxId: data.taxId || null
      }
    });

    res.json(client);
  } catch (error) {
    next(error);
  }
};
