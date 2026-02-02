/**
 * @fileoverview Middleware de Prevencion de Prototype Pollution y XSS
 *
 * Previene ataques de prototype pollution a traves del body parser de Express
 * y elimina etiquetas HTML de los strings para prevenir XSS almacenado.
 * Este es un fix critico de seguridad para P1-002.
 *
 * VECTOR DE ATAQUE: Payloads maliciosos como {"__proto__": {"admin": true}}
 * pueden contaminar Object.prototype y evadir la autenticacion, permitiendo
 * que cualquier objeto en la aplicacion herede propiedades inyectadas.
 *
 * @module middleware/sanitize-body
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Claves peligrosas que pueden causar prototype pollution.
 * Estas claves permiten modificar la cadena de prototipos de JavaScript,
 * afectando potencialmente a todos los objetos de la aplicacion.
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * SEC-025: Elimina etiquetas HTML de strings para prevenir XSS almacenado.
 * Conserva caracteres comunes como &, <, > como texto plano pero
 * remueve etiquetas HTML reales (ej: <script>, <img onerror=...>).
 */
const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/gi;
function stripHtmlTags(value: string): string {
  return value.replace(HTML_TAG_REGEX, '');
}

/**
 * Sanitiza recursivamente un objeto eliminando claves peligrosas
 * y removiendo etiquetas HTML de valores string.
 *
 * Recorre toda la estructura del objeto (incluyendo arrays y objetos anidados)
 * para asegurar que ningun nivel contenga datos maliciosos.
 *
 * @param obj - Objeto a sanitizar
 * @returns Objeto sanitizado sin claves peligrosas ni etiquetas HTML
 */
function sanitizeObject(obj: unknown): unknown {
  // SEC-025: Eliminar etiquetas HTML de valores string
  if (typeof obj === 'string') {
    return stripHtmlTags(obj);
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Omitir claves peligrosas que podrian contaminar el prototipo
    if (DANGEROUS_KEYS.includes(key)) {
      logger.warn('Dangerous key detected and removed', { key });
      continue;
    }

    // Sanitizar recursivamente objetos anidados
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Middleware que sanitiza el body, query params y route params de la solicitud.
 *
 * FIX P1-002: Previene prototype pollution a traves del body parser de Express.
 * Debe aplicarse DESPUES del body parser (express.json()) para que req.body
 * ya este parseado cuando este middleware lo procese.
 *
 * Sanitiza tres fuentes de entrada del usuario:
 * 1. req.body - Cuerpo de la solicitud (POST/PUT/PATCH)
 * 2. req.query - Parametros de consulta (?key=value)
 * 3. req.params - Parametros de ruta (/:id)
 *
 * Nota: req.query y req.params son propiedades getter-only en Express,
 * por lo que se modifican IN-PLACE (limpiando y reasignando claves).
 *
 * @example
 * ```typescript
 * app.use(express.json());
 * app.use(sanitizeBody); // Aplicar DESPUES del body parser
 * ```
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction): void | Response {
  try {
    // Sanitizar body (se puede reasignar directamente)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body) as typeof req.body;
    }

    // Sanitizar parametros de consulta IN-PLACE (req.query es propiedad getter-only)
    if (req.query && typeof req.query === 'object') {
      const sanitized = sanitizeObject(req.query);
      if (sanitized && typeof sanitized === 'object') {
        // Limpiar claves existentes
        for (const key in req.query) {
          delete req.query[key];
        }
        // Copiar claves sanitizadas
        Object.assign(req.query, sanitized);
      }
    }

    // Sanitizar parametros de ruta IN-PLACE (req.params es propiedad getter-only)
    if (req.params && typeof req.params === 'object') {
      const sanitized = sanitizeObject(req.params);
      if (sanitized && typeof sanitized === 'object') {
        // Limpiar claves existentes
        for (const key in req.params) {
          delete req.params[key];
        }
        // Copiar claves sanitizadas
        Object.assign(req.params, sanitized);
      }
    }

    next();
  } catch (error) {
    // Loguear informacion detallada del error para depuracion
    logger.error('Error in sanitizeBody middleware', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
      path: req.path,
      method: req.method
    });

    // Ante un error, rechazar la solicitud por seguridad (fail-safe)
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Request contains invalid data',
    });
  }
}
