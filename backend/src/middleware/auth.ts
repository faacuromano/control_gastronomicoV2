/**
 * @fileoverview Authentication Middleware
 * 
 * Handles JWT token validation and RBAC authorization.
 * 
 * @complexity O(1) for token validation
 * @guarantee OWASP ASVS 4.0 compliant
 * @implements TDD Section 3.2 - API Request Flow
 * 
 * FIX P0-004: Now reads JWT from HttpOnly cookie (primary) with
 * fallback to Authorization header for API key/service-to-service calls.
 * 
 * @module middleware/auth
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import type { JwtPayload, Permissions } from '../types/express-extensions';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * JWT secret from environment.
 * Will throw at import time if missing in auth.service.ts.
 */
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Cookie name for auth token (must match auth.controller.ts).
 */
const AUTH_COOKIE_NAME = 'auth_token';

// ============================================================================
// TOKEN EXTRACTION
// ============================================================================

/**
 * Extract JWT token from request.
 * 
 * Priority:
 * 1. HttpOnly cookie (recommended, XSS-resistant)
 * 2. Authorization Bearer header (for API keys / service-to-service)
 * 
 * @implements TDD Section 3.2 - API Request → Cookie Auth Flow
 * 
 * @param req - Express request object
 * @returns JWT token string or null if not found
 */
function extractToken(req: Request): string | null {
  // Priority 1: HttpOnly cookie (FIX P0-004)
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  // Priority 2: Authorization header (backwards compatibility / API keys)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.split(' ')[1];
    return headerToken ?? null;
  }

  return null;
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate requests using JWT token.
 * 
 * @complexity O(1) - JWT verification is constant time
 * @guarantee Token extracted from HttpOnly cookie (XSS-resistant)
 * @implements TDD Section 3.2 - Middleware Validation
 * 
 * FIX P0-004: Primary token source is now req.cookies[auth_token]
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
        logger.debug('Auth failed: no token found', {
            hasCookie: !!req.cookies?.[AUTH_COOKIE_NAME],
            hasAuthHeader: !!req.headers['authorization'],
            path: req.path,
        });
        return sendError(res, 'AUTH_REQUIRED', 'No token provided', null, 401);
    }

    if (!JWT_SECRET) {
        logger.error('JWT_SECRET not configured');
        return sendError(res, 'CONFIG_ERROR', 'Server configuration error', null, 500);
    }

    // FIX P1-003: Explicit algorithm to prevent "alg: none" attack
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            logger.debug('Auth failed: invalid token', {
                error: err.message,
                path: req.path,
            });
            return sendError(res, 'AUTH_INVALID', 'Invalid token', null, 403);
        }
        
        req.user = decoded as JwtPayload;
        next();
    });
};

export const authenticate = authenticateToken;

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Authorize requests based on role.
 * 
 * @param allowedRoles - Array of role names that can access the route
 */
export const authorize = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
             return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        const userRole = req.user.role; 

        if (!userRole) {
             return sendError(res, 'AUTH_INVALID', 'User has no role assigned', null, 403);
        }

        if (!allowedRoles.includes(userRole)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Role ${userRole} is not authorized`, null, 403);
        }

        next();
    };
};

/**
 * Middleware to enforce granular permissions based on RBAC.
 * Verifies if the authenticated user has the specific action allowed on the resource.
 * 
 * @business_rule
 * - ADMIN role has full access to all resources and actions (bypass)
 * - Other roles require explicit permissions in the token/user object
 * 
 * @param resource - The resource identifier (e.g. 'orders', 'products')
 * @param action - The action attempted (e.g. 'create', 'delete')
 */
export const requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        // ADMIN BYPASS: Admin role has full access to everything
        if (req.user.role === 'ADMIN') {
            return next();
        }

        const permissions: Permissions | undefined = req.user.permissions;

        // If no permissions found in token/user object, deny access
        if (!permissions) {
            return sendError(res, 'AUTH_INVALID', 'User has no permissions assigned', null, 403);
        }

        // Check if resource exists in permissions
        const resourcePermissions = permissions[resource];
        
        if (!resourcePermissions || !Array.isArray(resourcePermissions)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Access to resource '${resource}' denied`, null, 403);
        }

        if (!resourcePermissions.includes(action) && !resourcePermissions.includes('*')) {
             return sendError(res, 'AUTH_FORBIDDEN', `Action '${action}' on '${resource}' denied`, null, 403);
        }

        next();
    };
};


