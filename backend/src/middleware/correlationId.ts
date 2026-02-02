import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}

/**
 * Middleware que agrega IDs de correlacion para rastreo distribuido.
 *
 * Cada solicitud HTTP recibe un identificador unico que se propaga a traves
 * de todos los logs y respuestas, facilitando el seguimiento de una operacion
 * completa a traves de multiples servicios y capas de la aplicacion.
 *
 * Si el cliente envia el header X-Request-ID, se reutiliza ese valor;
 * de lo contrario, se genera un nuevo UUID v4 automaticamente.
 * El ID se devuelve al cliente en el header X-Request-ID de la respuesta.
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.correlationId = id;
    res.setHeader('X-Request-ID', id);
    next();
}
