import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { clientService } from '../services/client.service';

const createClientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional()
});

export const searchClients = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    const clients = await clientService.search(
        req.user!.tenantId!,
        typeof q === 'string' ? q : undefined
    );
    res.json(clients);
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
    const data = createClientSchema.parse(req.body);
    const { client, created } = await clientService.createOrUpdate(req.user!.tenantId!, data);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    res.status(created ? 201 : 200).json(client);
});
