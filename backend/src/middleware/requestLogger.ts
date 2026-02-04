/**
 * @fileoverview Middleware de logging estructurado de requests HTTP (API-004)
 *
 * Reemplaza morgan('dev') con logs JSON que incluyen metodo, ruta, status,
 * tiempo de respuesta y correlation ID. Compatible con el sistema de logger
 * estructurado existente para procesamiento automatizado (ELK, CloudWatch, etc.).
 *
 * @module middleware/requestLogger
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Registra cada request HTTP en formato JSON estructurado.
 * Captura metodo, ruta, status, tiempo de respuesta y correlation ID.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const meta = {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: duration,
            correlationId: req.correlationId,
        };

        if (res.statusCode >= 500) {
            logger.error('HTTP request', meta);
        } else if (res.statusCode >= 400) {
            logger.warn('HTTP request', meta);
        } else {
            logger.info('HTTP request', meta);
        }
    });

    next();
}
