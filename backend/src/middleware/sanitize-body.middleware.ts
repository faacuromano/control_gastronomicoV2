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
import { logger } from '../utils/logger';

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
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.includes(key)) {
      logger.warn('Dangerous key detected and removed', { key });
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
export function sanitizeBody(req: Request, res: Response, next: NextFunction): void | Response {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body) as typeof req.body;
    }

    // Sanitize query parameters (Express parses these as strings/arrays)
    // We need to be careful not to break Express's query parsing
    if (req.query && typeof req.query === 'object') {
      const sanitized = sanitizeObject(req.query);
      // Only apply if sanitization succeeded and returned an object
      if (sanitized && typeof sanitized === 'object') {
        req.query = sanitized as typeof req.query;
      }
    }

    // Sanitize route params (Express parses these as strings)
    if (req.params && typeof req.params === 'object') {
      const sanitized = sanitizeObject(req.params);
      // Only apply if sanitization succeeded and returned an object
      if (sanitized && typeof sanitized === 'object') {
        req.params = sanitized as typeof req.params;
      }
    }

    next();
  } catch (error) {
    // Log detailed error information
    logger.error('Error in sanitizeBody middleware', { 
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
