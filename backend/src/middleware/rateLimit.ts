/**
 * @fileoverview Middleware de Limitacion de Tasa (Rate Limiting)
 *
 * Protege contra ataques de fuerza bruta en endpoints de autenticacion
 * y contra abuso general de la API. Utiliza express-rate-limit para
 * rastrear solicitudes por IP y aplicar limites configurables.
 *
 * El rate limiting de autenticacion esta SIEMPRE activo, incluso en desarrollo,
 * porque los PINes de 6 digitos son vulnerables a fuerza bruta.
 */

import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Limitador de tasa para autenticacion - limites estrictos para intentos de login.
 * 5 intentos cada 15 minutos por IP.
 *
 * SIEMPRE ACTIVO - nunca se omite por seguridad, ya que los PINes de 6 digitos
 * tienen solo 10,000 combinaciones posibles y son vulnerables a fuerza bruta.
 * Solo se puede desactivar explicitamente en desarrollo con DISABLE_RATE_LIMIT=true.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 5, // SEGURIDAD: Limite estricto para prevenir fuerza bruta de PINes
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Demasiados intentos de login. Por favor espera 15 minutos.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // SEGURIDAD: Nunca omitir rate limiting en produccion
  skip: () => process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true',
  validate: { xForwardedForHeader: false }, // Desactivar validacion que causa error con IPv6
});

/**
 * Limitador de tasa general para la API - mas permisivo que el de autenticacion.
 * 100 solicitudes por minuto por IP en produccion, 10,000 en desarrollo.
 *
 * En desarrollo se eleva el limite a 10,000 para no interferir con pruebas
 * y recarga automatica del frontend (HMR), que genera muchas solicitudes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // Ventana de 1 minuto
  max: isDevelopment ? 10000 : 100,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Demasiadas solicitudes. Por favor espera un momento.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // CFG-002: En desarrollo se usa un límite alto en vez de omitir, para que el middleware
  // se ejercite y se detecten bugs de integración antes de producción
  // SEC-FIX: Production guard to prevent accidental bypass in production
  skip: () => process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true',
});

/**
 * Limitador de tasa para webhooks - proteccion por IP contra ataques de inundacion.
 * 60 solicitudes por minuto por IP.
 *
 * Las plataformas de delivery (PedidosYa, Rappi) envian rafagas de webhooks
 * al actualizar estados de pedidos, por lo que el limite es mas generoso
 * que el de autenticacion pero aun protege contra abuso.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // Ventana de 1 minuto
  max: 60,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Demasiadas solicitudes de webhook. Por favor reintenta más tarde.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Middleware que loguea una advertencia cuando una IP esta cerca del limite de tasa.
 * Se activa cuando quedan menos de 3 solicitudes disponibles, permitiendo
 * detectar posibles abusos antes de que el rate limiter bloquee al cliente.
 */
export const rateLimitLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const remaining = res.getHeader("RateLimit-Remaining");
  if (remaining && Number(remaining) < 3) {
    logger.warn(
      `[Rate Limit Warning] IP ${req.ip} has ${remaining} requests remaining`
    );
  }
  next();
};
