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
import { loginWithPin, register, loginWithPassword } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
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
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

const AUTH_COOKIE_NAME = 'auth_token';

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
 * Clear authentication cookie on logout.
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
    const { pin } = req.body;
    if (!pin) {
        return sendError(res, 'MISSING_PIN', 'PIN is required');
    }

    try {
        const result = await loginWithPin(pin);
        
        // FIX P0-004: Set token in HttpOnly cookie instead of response body
        setAuthCookie(res, result.token);
        
        // Audit: Log successful PIN login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PIN',
            role: result.user.role,
            authMethod: 'COOKIE' // Track that we're using cookie auth
        });
        
        // Return user data WITHOUT token (token is in cookie)
        return sendSuccess(res, { 
          user: result.user,
          // Token not included - it's in the HttpOnly cookie
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
    const result = await register(req.body);
    
    // FIX P0-004: Set token in HttpOnly cookie
    setAuthCookie(res, result.token);
    
    // Audit: User registration is a significant security event
    await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
        method: 'REGISTER',
        role: result.user.role,
        authMethod: 'COOKIE'
    });
    
    // Return user data WITHOUT token
    return sendSuccess(res, { 
      user: result.user,
      message: 'Registration successful'
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
        
        // Audit: Log successful password login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            role: result.user.role,
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
export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    // Clear the auth cookie
    clearAuthCookie(res);
    
    // Audit: Log logout
    if (req.user) {
        await auditService.logAuth('LOGOUT', req.user.id, getAuditContext(req), {
            authMethod: 'COOKIE'
        });
    }
    
    return sendSuccess(res, { message: 'Logged out successfully' });
});
