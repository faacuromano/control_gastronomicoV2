"use strict";
/**
 * Custom Error Classes
 * Provides typed errors for consistent error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.InsufficientStockError = exports.InternalError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.ApiError = void 0;
/**
 * Base class for API errors
 */
class ApiError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ApiError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
/**
 * 400 Bad Request - Validation errors
 */
class ValidationError extends ApiError {
    constructor(message = 'Validation failed', details) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * 401 Unauthorized - Authentication required or failed
 */
class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * 403 Forbidden - Not enough permissions
 */
class ForbiddenError extends ApiError {
    constructor(message = 'Access denied') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * 404 Not Found - Resource not found
 */
class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super('NOT_FOUND', `${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 409 Conflict - Resource already exists or conflict
 */
class ConflictError extends ApiError {
    constructor(message = 'Resource conflict') {
        super('CONFLICT', message, 409);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
/**
 * 429 Too Many Requests - Rate limited
 */
class RateLimitError extends ApiError {
    constructor(message = 'Too many requests') {
        super('RATE_LIMITED', message, 429);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
/**
 * 500 Internal Server Error
 */
class InternalError extends ApiError {
    constructor(message = 'Internal server error') {
        super('INTERNAL_ERROR', message, 500);
        this.name = 'InternalError';
    }
}
exports.InternalError = InternalError;
/**
 * 400 Insufficient Stock - Not enough ingredients to prepare the product
 */
class InsufficientStockError extends ApiError {
    constructor(productName, ingredientName, required, available) {
        const message = `No hay suficiente "${ingredientName}" para preparar "${productName}". ` +
            `Se necesitan ${required} pero solo hay ${available} disponibles.`;
        super('INSUFFICIENT_STOCK', message, 400, {
            productName,
            ingredientName,
            required,
            available
        });
        this.name = 'InsufficientStockError';
    }
}
exports.InsufficientStockError = InsufficientStockError;
/**
 * 503 Service Unavailable - Database or external service down
 */
class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service temporarily unavailable') {
        super('SERVICE_UNAVAILABLE', message, 503);
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
//# sourceMappingURL=errors.js.map