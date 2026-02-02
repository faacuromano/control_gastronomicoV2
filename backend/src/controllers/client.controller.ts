/**
 * @fileoverview Controlador de Clientes
 *
 * Gestiona la búsqueda y creación de clientes del restaurante.
 * Los clientes se asocian a órdenes para facturación, fidelización (loyalty)
 * y seguimiento de consumo. Usa lógica upsert: si el cliente existe
 * (por teléfono o email) lo retorna, si no lo crea.
 *
 * @module controllers/client.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { clientService } from '../services/client.service';
import { sendSuccess } from '../utils/response';

/**
 * Esquema de validación para creación de cliente.
 * SEC-023: Límites de longitud en campos de texto para prevenir abuso de almacenamiento.
 */
const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(30).optional()
});

/**
 * Busca clientes por texto libre (nombre, teléfono, email) con paginación.
 * Usado en el POS para asociar un cliente a una orden.
 */
export const searchClients = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit } = req.query;
    const result = await clientService.search(
        req.user!.tenantId!,
        typeof q === 'string' ? q : undefined,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 50
    );
    sendSuccess(res, result.data, result.meta);
});

/**
 * Crea un cliente nuevo o retorna el existente si ya hay uno con el mismo teléfono/email.
 * Patrón upsert: evita duplicados y simplifica la lógica del frontend.
 */
export const createClient = asyncHandler(async (req: Request, res: Response) => {
    const data = createClientSchema.parse(req.body);
    const { client, created } = await clientService.createOrUpdate(req.user!.tenantId!, data);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    sendSuccess(res, client, undefined, created ? 201 : 200);
});
