/**
 * Rate Limiting Middleware
 * Protects against brute force attacks on auth endpoints
 *
 * Rate limiting is ALWAYS active for auth, even in development
 */
import { Request, Response, NextFunction } from "express";
/**
 * Auth rate limiter - strict limits for login attempts
 * 5 attempts per 15 minutes per IP
 * ALWAYS ACTIVE - never skip for security
 */
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * General API rate limiter - more permissive
 * 100 requests per minute per IP
 */
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Middleware to log when rate limit is approaching
 */
export declare const rateLimitLogger: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rateLimit.d.ts.map