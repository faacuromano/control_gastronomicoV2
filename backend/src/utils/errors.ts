/**
 * Custom Error Classes
 * Provides typed errors for consistent error handling
 */

/**
 * Base class for API errors
 */
export class ApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500,
        public details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 Bad Request - Validation errors
 */
export class ValidationError extends ApiError {
    constructor(message: string = 'Validation failed', details?: unknown) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends ApiError {
    constructor(message: string = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}

/**
 * 403 Forbidden - Not enough permissions
 */
export class ForbiddenError extends ApiError {
    constructor(message: string = 'Access denied') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends ApiError {
    constructor(resource: string = 'Resource') {
        super('NOT_FOUND', `${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * 409 Conflict - Resource already exists or conflict
 */
export class ConflictError extends ApiError {
    constructor(message: string = 'Resource conflict') {
        super('CONFLICT', message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * 429 Too Many Requests - Rate limited
 */
export class RateLimitError extends ApiError {
    constructor(message: string = 'Too many requests') {
        super('RATE_LIMITED', message, 429);
        this.name = 'RateLimitError';
    }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends ApiError {
    constructor(message: string = 'Internal server error') {
        super('INTERNAL_ERROR', message, 500);
        this.name = 'InternalError';
    }
}

/**
 * 503 Service Unavailable - Database or external service down
 */
export class ServiceUnavailableError extends ApiError {
    constructor(message: string = 'Service temporarily unavailable') {
        super('SERVICE_UNAVAILABLE', message, 503);
        this.name = 'ServiceUnavailableError';
    }
}
