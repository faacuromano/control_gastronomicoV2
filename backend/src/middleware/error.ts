import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ApiError } from '../utils/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Middleware Global de Manejo de Errores
 *
 * Punto centralizado que captura TODOS los errores de la aplicacion y los transforma
 * en respuestas API consistentes. Express identifica este middleware como error handler
 * porque tiene 4 parametros (err, req, res, next).
 *
 * Orden de evaluacion:
 * 1. ApiError (errores personalizados de la app con codigo y status HTTP)
 * 2. ZodError (errores de validacion de esquemas Zod)
 * 3. PrismaClientKnownRequestError (errores conocidos de base de datos)
 * 4. PrismaClientValidationError (datos invalidos enviados a Prisma)
 * 5. Errores con propiedad statusCode (LockTimeoutError, InvalidStateTransitionError)
 * 6. SyntaxError (JSON malformado en el body de la solicitud)
 * 7. Error generico (respuesta 500 sin exponer detalles internos en produccion)
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // En desarrollo se loguea el error completo para facilitar el debug
    if (!isProduction) {
        logger.error('[Error Handler]', { error: err });
    } else {
        // ERR-008: En produccion, loguear CON stack trace para depuracion pero no exponer al cliente
        logger.error('[Error]', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }

    // Manejo de errores personalizados ApiError (ValidationError, NotFoundError, etc.)
    if (err instanceof ApiError) {
        return sendError(
            res,
            err.code,
            err.message,
            isProduction ? null : (err.details as Record<string, unknown> | null),
            err.statusCode
        );
    }

    // Manejo de errores de validacion de Zod (esquemas de entrada)
    if (err instanceof ZodError) {
        return sendError(
            res,
            'VALIDATION_ERROR',
            'Invalid data provided',
            isProduction ? null : err.issues,
            400
        );
    }

    // Manejo de errores conocidos de Prisma (base de datos)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': // Violacion de restriccion unica (registro duplicado)
                return sendError(res, 'DUPLICATE_ENTRY', 'This record already exists', null, 409);
            case 'P2025': // Registro no encontrado en operacion de update/delete
                return sendError(res, 'NOT_FOUND', 'Record not found', null, 404);
            case 'P2003': // Violacion de clave foranea (referencia a registro inexistente)
                return sendError(res, 'INVALID_REFERENCE', 'Referenced record does not exist', null, 400);
            default:
                return sendError(res, 'DATABASE_ERROR', 'Database operation failed', null, 500);
        }
    }

    // Error de validacion de Prisma (datos con formato incorrecto enviados al ORM)
    if (err instanceof Prisma.PrismaClientValidationError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid data format', null, 400);
    }

    // TST-007 FIX: Manejo de errores que tienen propiedad statusCode (LockTimeoutError, InvalidStateTransitionError)
    // Estos errores no extienden ApiError pero necesitan ser manejados con su status HTTP correcto
    const errWithStatus = err as Error & { statusCode?: number; code?: string };
    if (typeof errWithStatus.statusCode === 'number') {
        const code = typeof errWithStatus.code === 'string' ? errWithStatus.code : 'ERROR';
        return sendError(res, code, err.message, null, errWithStatus.statusCode);
    }

    // Error de parseo JSON (body de solicitud con JSON malformado)
    if (err instanceof SyntaxError && 'body' in err) {
        return sendError(res, 'INVALID_JSON', 'Invalid JSON in request body', null, 400);
    }

    // Default: Error Interno del Servidor
    // NUNCA exponer detalles de errores internos en produccion por seguridad
    return sendError(
        res,
        'INTERNAL_ERROR',
        isProduction ? 'An unexpected error occurred' : err.message,
        null,
        500
    );
};

/**
 * Manejador 404 para rutas no definidas.
 * Se registra como ultimo middleware en app.ts para capturar cualquier
 * ruta que no coincida con ninguna ruta registrada en el sistema.
 */
export const notFoundHandler = (req: Request, res: Response) => {
    return sendError(
        res,
        'NOT_FOUND',
        `Route ${req.method} ${req.path} not found`,
        null,
        404
    );
};
