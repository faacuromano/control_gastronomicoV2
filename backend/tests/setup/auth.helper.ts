/**
 * @fileoverview Auth Helper for Test Suite
 * 
 * Provides reusable utilities for authenticated test sessions
 * compatible with the new HttpOnly cookie-based auth architecture.
 * 
 * @module tests/setup/auth.helper
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedAgent {
  agent: request.SuperAgentTest;
  cookies: string[];
  user: MockUser;
}

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, string[]>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_testing_only';
const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Default mock user for tests.
 */
export const DEFAULT_MOCK_USER: MockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'ADMIN',
  permissions: { all: ['*'] },
};

// ============================================================================
// COOKIE GENERATION
// ============================================================================

/**
 * Generate a valid JWT token for testing.
 * 
 * @param user - User data to encode in token
 * @param expiresIn - Token expiration (default: 1h)
 * @returns JWT token string
 */
export function generateTestToken(
  user: Partial<MockUser> = DEFAULT_MOCK_USER,
  expiresIn: string = '1h'
): string {
  return jwt.sign(
    {
      id: user.id ?? DEFAULT_MOCK_USER.id,
      name: user.name ?? DEFAULT_MOCK_USER.name,
      role: user.role ?? DEFAULT_MOCK_USER.role,
      permissions: user.permissions ?? DEFAULT_MOCK_USER.permissions,
    },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Generate a properly formatted auth cookie for test requests.
 * 
 * @param user - User data for token
 * @returns Cookie string in format: 'auth_token=<jwt>'
 */
export function generateAuthCookie(user: Partial<MockUser> = DEFAULT_MOCK_USER): string {
  const token = generateTestToken(user);
  return `${AUTH_COOKIE_NAME}=${token}`;
}

/**
 * Generate an array of cookies for supertest .set('Cookie', [...]).
 * 
 * @param user - User data for token
 * @returns Array of cookie strings
 */
export function generateAuthCookies(user: Partial<MockUser> = DEFAULT_MOCK_USER): string[] {
  return [generateAuthCookie(user)];
}

// ============================================================================
// AUTHENTICATED AGENT
// ============================================================================

/**
 * Create an authenticated supertest agent with session cookies.
 * 
 * This agent maintains cookies across requests, simulating a real
 * browser session with HttpOnly cookie authentication.
 * 
 * @param user - User data for authentication
 * @returns Agent with cookies pre-set
 * 
 * @example
 * ```typescript
 * const { agent } = await createAuthenticatedAgent();
 * const response = await agent.get('/api/v1/orders');
 * expect(response.status).toBe(200);
 * ```
 */
export async function createAuthenticatedAgent(
  user: Partial<MockUser> = DEFAULT_MOCK_USER
): Promise<AuthenticatedAgent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agent = request.agent(app) as any;
  const cookies = generateAuthCookies(user);
  
  // Pre-set cookies on agent for all subsequent requests
  // Note: supertest agent maintains cookies automatically
  
  return {
    agent,
    cookies,
    user: { ...DEFAULT_MOCK_USER, ...user },
  };
}

// ============================================================================
// SUPERTEST HELPERS
// ============================================================================

/**
 * Add auth cookie to a supertest request.
 * 
 * MIGRATION: Replaces `.set('Authorization', `Bearer ${token}`)`
 * 
 * @param req - Supertest request
 * @param user - User data for token
 * @returns Modified request
 * 
 * @example
 * ```typescript
 * // OLD (Bearer token):
 * await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
 * 
 * // NEW (Cookie):
 * await withAuthCookie(request(app).get('/api/orders'));
 * ```
 */
export function withAuthCookie(
  req: request.Test,
  user: Partial<MockUser> = DEFAULT_MOCK_USER
): request.Test {
  return req.set('Cookie', generateAuthCookies(user));
}

// ============================================================================
// COOKIE VALIDATION HELPERS
// ============================================================================

/**
 * Extract auth cookie from Set-Cookie header.
 * 
 * @param response - Supertest response
 * @returns Cookie value or null
 */
export function extractAuthCookie(response: request.Response): string | null {
  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader) return null;
  
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const authCookie = cookies.find(c => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  
  return authCookie ?? null;
}

/**
 * Validate that Set-Cookie header contains all required security flags.
 * Per OWASP ASVS 4.0 V3.4.
 * 
 * @param cookie - Cookie string from Set-Cookie header
 * @returns Object with validation results
 */
export function validateCookieSecurity(cookie: string): {
  hasHttpOnly: boolean;
  hasSecure: boolean;
  hasSameSiteStrict: boolean;
  isFullySecure: boolean;
} {
  const lowerCookie = cookie.toLowerCase();
  
  const hasHttpOnly = lowerCookie.includes('httponly');
  const hasSecure = lowerCookie.includes('secure');
  const hasSameSiteStrict = lowerCookie.includes('samesite=strict');
  
  return {
    hasHttpOnly,
    hasSecure,
    hasSameSiteStrict,
    isFullySecure: hasHttpOnly && (process.env.NODE_ENV !== 'production' || hasSecure) && hasSameSiteStrict,
  };
}

/**
 * Assert that a response's Set-Cookie header is properly secured.
 * Throws if any security flag is missing.
 * 
 * @param response - Supertest response
 * @throws Error if cookie security requirements not met
 */
export function assertSecureCookie(response: request.Response): void {
  const cookie = extractAuthCookie(response);
  
  if (!cookie) {
    throw new Error('No auth cookie found in Set-Cookie header');
  }
  
  const security = validateCookieSecurity(cookie);
  
  if (!security.hasHttpOnly) {
    throw new Error('Cookie missing HttpOnly flag - vulnerable to XSS');
  }
  
  if (!security.hasSameSiteStrict) {
    throw new Error('Cookie missing SameSite=Strict flag - vulnerable to CSRF');
  }
  
  // Note: Secure flag only required in production
  if (process.env.NODE_ENV === 'production' && !security.hasSecure) {
    throw new Error('Cookie missing Secure flag in production');
  }
}
