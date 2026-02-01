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
 * Middleware that adds correlation IDs for distributed tracing.
 * Uses X-Request-ID header if provided, otherwise generates a new UUID.
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    req.correlationId = id;
    res.setHeader('X-Request-ID', id);
    next();
}
