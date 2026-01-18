/**
 * Custom Error Classes
 * Provides typed errors for consistent error handling
 */
/**
 * Base class for API errors
 */
export declare class ApiError extends Error {
    code: string;
    statusCode: number;
    details?: unknown | undefined;
    constructor(code: string, message: string, statusCode?: number, details?: unknown | undefined);
}
/**
 * 400 Bad Request - Validation errors
 */
export declare class ValidationError extends ApiError {
    constructor(message?: string, details?: unknown);
}
/**
 * 401 Unauthorized - Authentication required or failed
 */
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string);
}
/**
 * 403 Forbidden - Not enough permissions
 */
export declare class ForbiddenError extends ApiError {
    constructor(message?: string);
}
/**
 * 404 Not Found - Resource not found
 */
export declare class NotFoundError extends ApiError {
    constructor(resource?: string);
}
/**
 * 409 Conflict - Resource already exists or conflict
 */
export declare class ConflictError extends ApiError {
    constructor(message?: string);
}
/**
 * 429 Too Many Requests - Rate limited
 */
export declare class RateLimitError extends ApiError {
    constructor(message?: string);
}
/**
 * 500 Internal Server Error
 */
export declare class InternalError extends ApiError {
    constructor(message?: string);
}
/**
 * 400 Insufficient Stock - Not enough ingredients to prepare the product
 */
export declare class InsufficientStockError extends ApiError {
    constructor(productName: string, ingredientName: string, required: number, available: number);
}
/**
 * 503 Service Unavailable - Database or external service down
 */
export declare class ServiceUnavailableError extends ApiError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map