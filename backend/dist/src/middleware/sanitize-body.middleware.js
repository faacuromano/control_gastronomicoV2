"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeBody = sanitizeBody;
const logger_1 = require("../utils/logger");
/**
 * Dangerous keys that can cause prototype pollution.
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
/**
 * Recursively sanitize an object by removing dangerous keys.
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Skip dangerous keys
        if (DANGEROUS_KEYS.includes(key)) {
            logger_1.logger.warn('Dangerous key detected and removed', { key });
            continue;
        }
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
}
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
function sanitizeBody(req, res, next) {
    try {
        // Sanitize body
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query);
        }
        // Sanitize route params
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in sanitizeBody middleware', { error });
        // On error, reject the request to be safe
        return res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Request contains invalid data',
        });
    }
}
//# sourceMappingURL=sanitize-body.middleware.js.map