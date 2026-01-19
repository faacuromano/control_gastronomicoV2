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
        // Sanitize body (can be reassigned)
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }
        // Sanitize query parameters IN-PLACE (req.query is a getter-only property)
        if (req.query && typeof req.query === 'object') {
            const sanitized = sanitizeObject(req.query);
            if (sanitized && typeof sanitized === 'object') {
                // Clear existing keys
                for (const key in req.query) {
                    delete req.query[key];
                }
                // Copy sanitized keys
                Object.assign(req.query, sanitized);
            }
        }
        // Sanitize route params IN-PLACE (req.params is a getter-only property)
        if (req.params && typeof req.params === 'object') {
            const sanitized = sanitizeObject(req.params);
            if (sanitized && typeof sanitized === 'object') {
                // Clear existing keys
                for (const key in req.params) {
                    delete req.params[key];
                }
                // Copy sanitized keys
                Object.assign(req.params, sanitized);
            }
        }
        next();
    }
    catch (error) {
        // Log detailed error information
        logger_1.logger.error('Error in sanitizeBody middleware', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            body: req.body,
            path: req.path,
            method: req.method
        });
        // On error, reject the request to be safe
        return res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Request contains invalid data',
        });
    }
}
//# sourceMappingURL=sanitize-body.middleware.js.map