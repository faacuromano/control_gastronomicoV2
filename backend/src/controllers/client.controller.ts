import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { clientService } from '../services/client.service';
import { sendSuccess } from '../utils/response';

// SEC-023: Max length validation on text fields
const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(30).optional()
});

export const searchClients = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    const clients = await clientService.search(
        req.user!.tenantId!,
        typeof q === 'string' ? q : undefined
    );
    sendSuccess(res, clients);
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
    const data = createClientSchema.parse(req.body);
    const { client, created } = await clientService.createOrUpdate(req.user!.tenantId!, data);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    sendSuccess(res, client, undefined, created ? 201 : 200);
});
