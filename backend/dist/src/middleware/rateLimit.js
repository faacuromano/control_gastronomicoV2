"use strict";
/**
 * Rate Limiting Middleware
 * Protects against brute force attacks on auth endpoints
 *
 * DISABLED in development mode for convenience
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitLogger = exports.apiRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const isDevelopment = process.env.NODE_ENV === 'development';
/**
 * Auth rate limiter - strict limits for login attempts
 * 5 attempts per 15 minutes per IP
 */
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 1000 : 5, // Very permissive in dev, strict in prod
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Demasiados intentos de login. Por favor espera 15 minutos.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment, // Skip rate limiting entirely in development
    keyGenerator: (req) => {
        // Use X-Forwarded-For if behind proxy, otherwise IP
        return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    }
});
/**
 * General API rate limiter - more permissive
 * 100 requests per minute per IP
 */
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: isDevelopment ? 10000 : 100,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Demasiadas solicitudes. Por favor espera un momento.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});
/**
 * Middleware to log when rate limit is approaching
 */
const rateLimitLogger = (req, res, next) => {
    const remaining = res.getHeader('RateLimit-Remaining');
    if (remaining && Number(remaining) < 3) {
        console.warn(`[Rate Limit Warning] IP ${req.ip} has ${remaining} requests remaining`);
    }
    next();
};
exports.rateLimitLogger = rateLimitLogger;
//# sourceMappingURL=rateLimit.js.map