import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ApiError } from '../utils/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Global Error Handler Middleware
 * Handles all errors and sends consistent API responses
 */
export const errorHandler = (
    err: Error, 
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    // Log the error (in production, use a proper logging service)
    if (!isProduction) {
        console.error('[Error Handler]', err);
    } else {
        // In production, log without stack trace to external service
        console.error('[Error]', {
            name: err.name,
            message: err.message,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }

    // Handle our custom ApiError classes
    if (err instanceof ApiError) {
        return sendError(
            res, 
            err.code, 
            err.message, 
            isProduction ? null : (err.details as Record<string, unknown> | null), 
            err.statusCode
        );
    }

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        return sendError(
            res, 
            'VALIDATION_ERROR', 
            'Invalid data provided', 
            isProduction ? null : err.issues, 
            400
        );
    }

    // Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': // Unique constraint violation
                return sendError(res, 'DUPLICATE_ENTRY', 'This record already exists', null, 409);
            case 'P2025': // Record not found
                return sendError(res, 'NOT_FOUND', 'Record not found', null, 404);
            case 'P2003': // Foreign key constraint failed
                return sendError(res, 'INVALID_REFERENCE', 'Referenced record does not exist', null, 400);
            default:
                return sendError(res, 'DATABASE_ERROR', 'Database operation failed', null, 500);
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid data format', null, 400);
    }

    // Handle JSON parsing errors
    if (err instanceof SyntaxError && 'body' in err) {
        return sendError(res, 'INVALID_JSON', 'Invalid JSON in request body', null, 400);
    }

    // Default: Internal Server Error
    // NEVER expose internal error details in production
    return sendError(
        res, 
        'INTERNAL_ERROR', 
        isProduction ? 'An unexpected error occurred' : err.message,
        null, 
        500
    );
};

/**
 * 404 Handler for undefined routes
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

