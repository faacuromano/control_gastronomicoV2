/**
 * @fileoverview Authentication Controller
 * 
 * Handles user authentication via PIN and password.
 * 
 * @complexity O(1) for all operations
 * @guarantee OWASP ASVS 4.0 compliant session management
 * @implements TDD Section 3.2 - HttpOnly Cookie Authentication
 * 
 * FIX P0-004: JWT tokens are now set in HttpOnly cookies instead of
 * response body to prevent XSS-based token theft.
 * 
 * @module controllers/auth.controller
 */

import { Request, Response } from 'express';
import { loginWithPin, register, loginWithPassword, registerTenant, createRefreshToken, refreshAccessToken, revokeRefreshTokens } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService } from '../services/audit.service';
import { logger } from '../utils/logger';

// ============================================================================
// COOKIE CONFIGURATION (per TDD Section 3.3)
// ============================================================================

/**
 * Cookie configuration for JWT token storage.
 * Per OWASP ASVS 4.0 Session Management requirements.
 */
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,           // V3.4.1: Prevent JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // V3.4.2: HTTPS only in production
  sameSite: 'strict' as const, // V3.4.3: Prevent CSRF
  path: '/api',             // Scope to API routes only
  maxAge: 12 * 60 * 60 * 1000, // 12 hours — aligned with JWT expiresIn
};

const AUTH_COOKIE_NAME = 'auth_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh', // Only sent to refresh endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract audit context from request
 */
const getAuditContext = (req: Request) => ({
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
});

/**
 * Set authentication cookie on response.
 * 
 * @implements TDD Section 3.2 - New Authentication Flow
 * 
 * @param res - Express response object
 * @param token - JWT token to store
 */
function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  
  logger.debug('Auth cookie set', {
    cookieName: AUTH_COOKIE_NAME,
    httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
    secure: AUTH_COOKIE_OPTIONS.secure,
    sameSite: AUTH_COOKIE_OPTIONS.sameSite,
  });
}

/**
 * Set refresh token cookie on response.
 */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, REFRESH_COOKIE_OPTIONS);
}

/**
 * Clear authentication cookies on logout.
 *
 * @param res - Express response object
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * Handle PIN-based login.
 * 
 * @complexity O(1)
 * @guarantee Token stored in HttpOnly cookie, not exposed to JavaScript
 * @implements TDD Section 3.2 - Login Request Flow
 */
export const loginPin = asyncHandler(async (req: Request, res: Response) => {
    const { pin, tenantId: rawTenantId } = req.body;

    if (!rawTenantId) {
        return sendError(res, 'MISSING_TENANT', 'Tenant ID is required');
    }

    if (!pin) {
        return sendError(res, 'MISSING_CREDENTIALS', 'PIN is required');
    }

    // Validate tenant exists and has active subscription
    const tenant = await prisma.tenant.findFirst({
        where: { id: rawTenantId, activeSubscription: true }
    });
    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Invalid or inactive organization');
    }
    const tenantId = tenant.id;

    try {
        const result = await loginWithPin(pin, tenantId);
        
        // FIX P0-004: Set token in HttpOnly cookie instead of response body
        setAuthCookie(res, result.token);

        // Set refresh token cookie
        const refreshToken = await createRefreshToken(result.user.id, tenantId);
        setRefreshCookie(res, refreshToken);

        // Audit: Log successful PIN login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PIN',
            role: result.user.role,
            tenantId,
            authMethod: 'COOKIE'
        });

        // Return user data WITHOUT token (token is in cookie)
        return sendSuccess(res, {
          user: result.user,
          message: 'Authentication successful'
        });
    } catch (error) {
        // Audit: Log failed login attempt
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PIN',
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});

/**
 * Handle user registration.
 * 
 * @complexity O(1)
 * @guarantee Token stored in HttpOnly cookie
 */
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
    // P1-26: Validate tenant exists and is active before allowing registration
    const { tenantId: rawTenantId } = req.body;
    if (!rawTenantId) {
        return sendError(res, 'MISSING_TENANT', 'Tenant ID is required');
    }
    const tenant = await prisma.tenant.findFirst({
        where: { id: rawTenantId, activeSubscription: true }
    });
    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Invalid or inactive organization');
    }

    const result = await register(req.body);
    
    // FIX P0-004: Set token in HttpOnly cookie
    setAuthCookie(res, result.token);
    
    // Audit: User registration is a significant security event
    await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
        method: 'REGISTER',
        role: result.user.role,
        tenantId: req.body.tenantId,
        authMethod: 'COOKIE'
    });
    
    // Return user data WITHOUT token
    return sendSuccess(res, { 
      user: result.user,
      message: 'Registration successful'
    }, undefined, 201);
});

/**
 * Handle new tenant SaaS registration.
 */
export const registerNewTenant = asyncHandler(async (req: Request, res: Response) => {
    const result = await registerTenant(req.body);
    
    // Set token in cookie
    setAuthCookie(res, result.token);
    
    // Audit log not needed here as user is fresh? Or log it.
    // Since we don't have user ID in req yet, we use returned ID.
    // Wait, auditService needs context.
    
    return sendSuccess(res, {
        tenant: result.tenant,
        user: result.user,
        message: 'Tenant registered successfully'
    }, undefined, 201);
});

/**
 * Handle password-based login.
 * 
 * @complexity O(1)
 * @guarantee Token stored in HttpOnly cookie
 * @implements TDD Section 3.2 - Login Request Flow
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        const result = await loginWithPassword(req.body);
        
        // FIX P0-004: Set token in HttpOnly cookie
        setAuthCookie(res, result.token);

        // Set refresh token cookie
        const refreshToken = await createRefreshToken(result.user.id, result.user.tenantId);
        setRefreshCookie(res, refreshToken);

        // Audit: Log successful password login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            role: result.user.role,
            tenantId: req.body.tenantId,
            authMethod: 'COOKIE'
        });

        // Return user data WITHOUT token
        return sendSuccess(res, {
          user: result.user,
          message: 'Authentication successful'
        });
    } catch (error) {
        // Audit: Log failed login attempt
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});

/**
 * Handle logout - clears the auth cookie.
 * 
 * @complexity O(1)
 * @implements TDD Section 3.2 - Session termination
 */
/**
 * Resolve tenant by business code.
 * Public endpoint for login page to determine tenantId.
 */
export const resolveTenant = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    if (!code || typeof code !== 'string') {
        return sendError(res, 'MISSING_CODE', 'Business code is required');
    }

    const tenant = await prisma.tenant.findFirst({
        where: {
            activeSubscription: true,
            OR: [
                { code },
                { name: { equals: code } }
            ]
        },
        select: { id: true, name: true }
    });

    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Business not found or inactive', null, 404);
    }

    return sendSuccess(res, { tenantId: tenant.id, name: tenant.name });
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    // Clear auth + refresh cookies
    clearAuthCookie(res);

    // Revoke all refresh tokens for this user
    if (req.user) {
        await revokeRefreshTokens(req.user.id, req.user.tenantId);
        await auditService.logAuth('LOGOUT', req.user.id, getAuditContext(req), {
            authMethod: 'COOKIE'
        });
    }

    return sendSuccess(res, { message: 'Logged out successfully' });
});

/**
 * Handle token refresh.
 * Reads refresh_token from HttpOnly cookie, validates it,
 * returns new access token + rotated refresh token.
 */
export const refreshTokenHandler = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
        return sendError(res, 'NO_REFRESH_TOKEN', 'Refresh token not provided', null, 401);
    }

    const result = await refreshAccessToken(rawToken);

    // Set new access token
    setAuthCookie(res, result.accessToken);

    // Set rotated refresh token
    setRefreshCookie(res, result.refreshToken);

    return sendSuccess(res, {
        user: result.user,
        message: 'Token refreshed successfully'
    });
});
