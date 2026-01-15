"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const errors_1 = require("../utils/errors");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const isProduction = process.env.NODE_ENV === 'production';
/**
 * Global Error Handler Middleware
 * Handles all errors and sends consistent API responses
 */
const errorHandler = (err, req, res, next) => {
    // Log the error (in production, use a proper logging service)
    if (!isProduction) {
        console.error('[Error Handler]', err);
    }
    else {
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
    if (err instanceof errors_1.ApiError) {
        return (0, response_1.sendError)(res, err.code, err.message, isProduction ? null : err.details, err.statusCode);
    }
    // Handle Zod validation errors
    if (err instanceof zod_1.ZodError) {
        return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid data provided', isProduction ? null : err.issues, 400);
    }
    // Handle Prisma errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': // Unique constraint violation
                return (0, response_1.sendError)(res, 'DUPLICATE_ENTRY', 'This record already exists', null, 409);
            case 'P2025': // Record not found
                return (0, response_1.sendError)(res, 'NOT_FOUND', 'Record not found', null, 404);
            case 'P2003': // Foreign key constraint failed
                return (0, response_1.sendError)(res, 'INVALID_REFERENCE', 'Referenced record does not exist', null, 400);
            default:
                return (0, response_1.sendError)(res, 'DATABASE_ERROR', 'Database operation failed', null, 500);
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid data format', null, 400);
    }
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && 'body' in err) {
        return (0, response_1.sendError)(res, 'INVALID_JSON', 'Invalid JSON in request body', null, 400);
    }
    // Default: Internal Server Error
    // NEVER expose internal error details in production
    return (0, response_1.sendError)(res, 'INTERNAL_ERROR', isProduction ? 'An unexpected error occurred' : err.message, null, 500);
};
exports.errorHandler = errorHandler;
/**
 * 404 Handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    return (0, response_1.sendError)(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, null, 404);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.js.map