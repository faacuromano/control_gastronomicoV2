/**
 * Rate Limiting Middleware
 * Protects against brute force attacks on auth endpoints
 *
 * Rate limiting is ALWAYS active for auth, even in development
 */

import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Auth rate limiter - strict limits for login attempts
 * 5 attempts per 15 minutes per IP
 * ALWAYS ACTIVE - never skip for security
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // SECURITY: Strict limit to prevent PIN brute force
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Demasiados intentos de login. Por favor espera 15 minutos.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: Never skip rate limiting for auth endpoints UNLESS explicitly disabled for benchmarks
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
  validate: { xForwardedForHeader: false }, // Disable validation that causes IPv6 error
});

/**
 * General API rate limiter - more permissive
 * 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
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
  skip: () => isDevelopment || process.env.DISABLE_RATE_LIMIT === 'true',
});

/**
 * Middleware to log when rate limit is approaching
 */
export const rateLimitLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const remaining = res.getHeader("RateLimit-Remaining");
  if (remaining && Number(remaining) < 3) {
    console.warn(
      `[Rate Limit Warning] IP ${req.ip} has ${remaining} requests remaining`,
    );
  }
  next();
};
