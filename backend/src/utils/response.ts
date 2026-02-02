/**
 * @fileoverview Helpers de respuesta estandarizada para la API.
 *
 * Define la estructura JSON comun para todas las respuestas de la API,
 * asegurando consistencia entre endpoints exitosos y de error.
 * Todos los controladores usan sendSuccess/sendError en lugar de
 * res.json() directo, lo que facilita cambios globales al formato de respuesta.
 *
 * Estructura de respuesta exitosa:
 *   { success: true, data: T, meta?: { page, limit, total, totalPages } }
 *
 * Estructura de respuesta de error:
 *   { success: false, error: { code, message, details? } }
 *
 * @module utils/response
 */

import { Response } from 'express';

/**
 * Interfaz generica que define la estructura de todas las respuestas de la API.
 * El campo 'success' permite al frontend distinguir rapidamente entre exito y error.
 * El campo 'meta' se incluye solo en respuestas paginadas (listados).
 */
interface ApiResponse<T> {
    success: boolean;
    data?: T | undefined;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | readonly Record<string, unknown>[] | object[] | null | undefined;
    } | undefined;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    } | undefined;
}

/**
 * Envia una respuesta exitosa con formato estandarizado.
 *
 * @param res - Objeto Response de Express
 * @param data - Datos a incluir en la respuesta (tipo generico)
 * @param meta - Metadata de paginacion opcional (para listados)
 * @param statusCode - Codigo HTTP, por defecto 200. Usar 201 para creaciones.
 *
 * @example
 * // Respuesta simple
 * sendSuccess(res, order);
 *
 * // Respuesta paginada
 * sendSuccess(res, products, { page: 1, limit: 20, total: 100, totalPages: 5 });
 *
 * // Respuesta de creacion
 * sendSuccess(res, newProduct, undefined, 201);
 */
export const sendSuccess = <T>(res: Response, data: T, meta?: ApiResponse<T>['meta'], statusCode = 200) => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        meta,
    };
    return res.status(statusCode).json(response);
};

/**
 * Envia una respuesta de error con formato estandarizado.
 *
 * Nota: Esta funcion se usa principalmente en el middleware global de errores
 * y en casos especiales. Los servicios normalmente lanzan subclases de ApiError
 * que el middleware convierte automaticamente en respuestas formateadas.
 *
 * @param res - Objeto Response de Express
 * @param code - Codigo interno del error (ej: 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - Mensaje legible del error
 * @param details - Detalles adicionales opcionales (ej: errores de validacion por campo)
 * @param statusCode - Codigo HTTP, por defecto 400
 */
export const sendError = (res: Response, code: string, message: string, details?: Record<string, unknown> | readonly Record<string, unknown>[] | object[] | null, statusCode = 400) => {
    const response: ApiResponse<null> = {
        success: false,
        error: {
            code,
            message,
            details: details || undefined,
        },
    };
    return res.status(statusCode).json(response);
};
