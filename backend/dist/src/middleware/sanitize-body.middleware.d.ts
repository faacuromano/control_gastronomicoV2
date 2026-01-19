/**
 * @fileoverview Prototype Pollution Prevention Middleware
 *
 * Prevents prototype pollution attacks via Express body parser.
 * This is a critical security fix for P1-002.
 *
 * ATTACK VECTOR: Malicious payloads like {"__proto__": {"admin": true}}
 * can pollute Object.prototype and bypass authentication.
 *
 * @module middleware/sanitize-body
 */
import type { Request, Response, NextFunction } from 'express';
/**
 * Middleware to sanitize request body, query, and params.
 *
 * FIX P1-002: Prevents prototype pollution via Express body parser.
 *
 * @example
 * ```typescript
 * app.use(express.json());
 * app.use(sanitizeBody); // Apply AFTER body parser
 * ```
 */
export declare function sanitizeBody(req: Request, res: Response, next: NextFunction): void | Response;
//# sourceMappingURL=sanitize-body.middleware.d.ts.map