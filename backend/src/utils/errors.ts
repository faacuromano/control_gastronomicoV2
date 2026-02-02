/**
 * @fileoverview Clases de error personalizadas para la API.
 *
 * Define una jerarquia de errores tipados que extienden ApiError como clase base.
 * Cada subclase representa un codigo HTTP especifico, lo que permite al middleware
 * global de errores (middleware/error.ts) capturar cualquier instancia de ApiError
 * y responder con el statusCode y estructura JSON correctos.
 *
 * Patron de uso en servicios:
 *   throw new NotFoundError('Producto');        // -> 404 { code: 'NOT_FOUND', message: 'Producto not found' }
 *   throw new ValidationError('Campo invalido'); // -> 400 { code: 'VALIDATION_ERROR', ... }
 *
 * @module utils/errors
 */

/**
 * Clase base para todos los errores de la API.
 *
 * Contiene el codigo interno (string), mensaje legible, statusCode HTTP
 * y un campo opcional 'details' para informacion adicional (ej: errores de validacion por campo).
 * Captura el stack trace para facilitar el debugging en desarrollo.
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
        // Captura el stack trace excluyendo el constructor para trazas mas limpias
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 Bad Request - Errores de validacion de datos de entrada.
 * Se usa cuando el body del request no cumple con el schema esperado (Zod, etc.).
 * El campo 'details' tipicamente contiene los errores de validacion por campo.
 */
export class ValidationError extends ApiError {
    constructor(message: string = 'Validation failed', details?: unknown) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}

/**
 * 400 Bad Request - Error generico de solicitud incorrecta.
 * Se usa cuando la solicitud es invalida por razones de logica de negocio
 * (ej: intentar cerrar un turno que ya esta cerrado), no por validacion de schema.
 */
export class BadRequestError extends ApiError {
    constructor(message: string = 'Bad request', details?: unknown) {
        super('BAD_REQUEST', message, 400, details);
        this.name = 'BadRequestError';
    }
}

/**
 * 401 Unauthorized - Autenticacion requerida o fallida.
 * Se lanza cuando no hay token JWT, el token es invalido o ha expirado.
 * El middleware de auth (middleware/auth.ts) lanza este error automaticamente.
 */
export class UnauthorizedError extends ApiError {
    constructor(message: string = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}

/**
 * 403 Forbidden - Permisos insuficientes.
 * El usuario esta autenticado pero no tiene los permisos RBAC necesarios
 * para ejecutar la accion solicitada (ej: un mozo intentando eliminar productos).
 */
export class ForbiddenError extends ApiError {
    constructor(message: string = 'Access denied') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}

/**
 * 404 Not Found - Recurso no encontrado.
 * Recibe el nombre del recurso como parametro para construir un mensaje descriptivo.
 * Ejemplo: new NotFoundError('Orden') -> "Orden not found"
 */
export class NotFoundError extends ApiError {
    constructor(resource: string = 'Resource') {
        super('NOT_FOUND', `${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * 409 Conflict - Conflicto con el estado actual del recurso.
 * Se usa cuando hay duplicados (ej: email ya registrado),
 * o estados inconsistentes (ej: orden ya cancelada).
 */
export class ConflictError extends ApiError {
    constructor(message: string = 'Resource conflict') {
        super('CONFLICT', message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * 429 Too Many Requests - Limite de tasa excedido.
 * Se lanza desde el middleware de rate limiting cuando un cliente
 * supera el numero maximo de requests permitidos por ventana de tiempo.
 */
export class RateLimitError extends ApiError {
    constructor(message: string = 'Too many requests') {
        super('RATE_LIMITED', message, 429);
        this.name = 'RateLimitError';
    }
}

/**
 * 500 Internal Server Error - Error interno del servidor.
 * Error generico para fallos inesperados. En produccion, el middleware global
 * captura excepciones no controladas y las convierte en este tipo de error
 * para evitar exponer detalles internos al cliente.
 */
export class InternalError extends ApiError {
    constructor(message: string = 'Internal server error') {
        super('INTERNAL_ERROR', message, 500);
        this.name = 'InternalError';
    }
}

/**
 * 400 Insufficient Stock - Stock insuficiente para preparar un producto.
 * Se lanza durante la validacion de items de una orden cuando un ingrediente
 * no tiene cantidad suficiente en inventario. Incluye detalles especificos
 * (nombre del producto, ingrediente, cantidad requerida vs disponible)
 * para que el frontend pueda mostrar un mensaje informativo al usuario.
 */
export class InsufficientStockError extends ApiError {
    constructor(
        productName: string,
        ingredientName: string,
        required: number,
        available: number
    ) {
        const message = `Insufficient "${ingredientName}" to prepare "${productName}". ` +
                        `Required: ${required}, available: ${available}.`;
        super('INSUFFICIENT_STOCK', message, 400, {
            productName,
            ingredientName,
            required,
            available
        });
        this.name = 'InsufficientStockError';
    }
}

/**
 * 503 Service Unavailable - Servicio temporalmente no disponible.
 * Se usa cuando la base de datos, Redis u otro servicio externo
 * no responde. Indica al cliente que debe reintentar mas tarde.
 */
export class ServiceUnavailableError extends ApiError {
    constructor(message: string = 'Service temporarily unavailable') {
        super('SERVICE_UNAVAILABLE', message, 503);
        this.name = 'ServiceUnavailableError';
    }
}
