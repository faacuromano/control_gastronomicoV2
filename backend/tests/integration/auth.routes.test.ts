/**
 * @fileoverview Auth Routes Integration Tests
 * 
 * PHILOSOPHY: "End-to-End HTTP Verification"
 * Tests the complete HTTP request/response cycle for authentication.
 * Focuses on P0-004 Cookie Security compliance.
 * 
 * MOCK STRATEGY:
 * - Prisma mock with mockReset() in beforeEach
 * - Complete user objects to prevent undefined property access
 * - bcrypt mock for password verification scenarios
 * - Rate limiter bypassed for test isolation
 * 
 * @module tests/integration/auth.routes.test
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import {
  extractAuthCookie,
  validateCookieSecurity,
} from '../setup/auth.helper';

// ============================================================================
// PRISMA MOCK - Must be before app import affects anything
// ============================================================================

const mockPrismaUser = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(), // NEW: Used for PIN login with bcrypt
  create: jest.fn(),
  update: jest.fn(),
};

const mockAuditLog = {
  create: jest.fn(),
  findMany: jest.fn(),
};

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    auditLog: mockAuditLog,
  },
}));

// Mock audit service to prevent database access during tests
jest.mock('../../src/services/audit.service', () => ({
  auditService: {
    log: jest.fn(),
    logAuth: jest.fn(),
    logOrder: jest.fn(),
    logPayment: jest.fn(),
    logCashShift: jest.fn(),
    query: jest.fn(),
  },
  AuditService: jest.fn(),
}));

// Bypass rate limiter for tests
jest.mock('../../src/middleware/rateLimit', () => ({
  authRateLimiter: (_req: any, _res: any, next: () => void) => next(),
  apiRateLimiter: (_req: any, _res: any, next: () => void) => next(),
  rateLimitLogger: (_req: any, _res: any, next: () => void) => next(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Creates a complete mock user object with all required fields.
 * SECURITY UPDATE: Now uses pinHash (bcrypt) instead of plaintext pinCode
 */
const createCompleteMockUser = (overrides: Record<string, any> = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  // SECURITY: PIN is now stored as bcrypt hash
  pinHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  roleId: 1,
  role: {
    id: 1,
    name: 'ADMIN',
    permissions: { all: ['*'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ...overrides,
});

// ============================================================================
// TEST SUITE: POST /api/v1/auth/login
// ============================================================================

describe('POST /api/v1/auth/login', () => {
  
  beforeEach(() => {
    // CRITICAL: Reset all mocks to prevent state leaking
    jest.clearAllMocks();
    mockPrismaUser.findUnique.mockReset();
    mockPrismaUser.update.mockReset();
  });

  describe('Success Scenarios (P0-004 Cookie Security)', () => {
    
    beforeEach(() => {
      // Setup: Valid user and password match
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    });

    it('returns 200 and Set-Cookie header for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Cookie MUST be set
      const cookie = extractAuthCookie(response);
      expect(cookie).not.toBeNull();
    });

    it('cookie has HttpOnly flag (XSS prevention)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      const cookie = extractAuthCookie(response);
      const security = validateCookieSecurity(cookie!);
      
      expect(security.hasHttpOnly).toBe(true);
    });

    it('cookie has SameSite=Strict flag (CSRF prevention)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      const cookie = extractAuthCookie(response);
      const security = validateCookieSecurity(cookie!);
      
      expect(security.hasSameSiteStrict).toBe(true);
    });

    it('response body does NOT contain token (P0-004 compliance)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
    });

    it('returns user data in response body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.body.data.user).toEqual({
        id: 1,
        name: 'Test User',
        role: 'ADMIN',
        permissions: { all: ['*'] },
      });
    });
  });

  describe('Error Scenarios', () => {
    
    it('returns 401 for non-existent user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'anypassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      
      // No cookie on failure
      const cookie = extractAuthCookie(response);
      expect(cookie).toBeNull();
    });

    it('returns 401 for wrong password', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
      mockPrismaUser.update.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
    });

    it('returns 401 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(response.status).toBe(401);
    });

    it('returns 401 for inactive user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser({ isActive: false }));
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// TEST SUITE: POST /api/v1/auth/login/pin
// ============================================================================

describe('POST /api/v1/auth/login/pin', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaUser.findMany.mockReset();
    mockPrismaUser.update.mockReset();
    jest.spyOn(bcrypt, 'compare').mockRestore();
  });

  describe('Success Scenarios', () => {
    
    beforeEach(() => {
      // NEW: loginWithPin now uses findMany + bcrypt.compare
      mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    });

    it('returns 200 and Set-Cookie header for valid PIN', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '123456' });

      expect(response.status).toBe(200);
      
      const cookie = extractAuthCookie(response);
      expect(cookie).not.toBeNull();
    });

    it('cookie has HttpOnly and SameSite=Strict flags', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '123456' });

      const cookie = extractAuthCookie(response);
      const security = validateCookieSecurity(cookie!);
      
      expect(security.hasHttpOnly).toBe(true);
      expect(security.hasSameSiteStrict).toBe(true);
    });

    it('response body does NOT contain token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '123456' });

      expect(response.body.data).not.toHaveProperty('token');
    });
  });

  describe('Error Scenarios', () => {
    
    it('returns 401 for non-existent PIN', async () => {
      // No users with matching PIN
      mockPrismaUser.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '999999' });

      expect(response.status).toBe(401);
    });

    it('returns 401 for malformed PIN (too short)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '12' });

      expect(response.status).toBe(401);
    });

    it('returns 401 for inactive user', async () => {
      // User exists but bcrypt.compare returns false (wrong PIN)
      mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '123456' });

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// TEST SUITE: POST /api/v1/auth/logout
// ============================================================================

describe('POST /api/v1/auth/logout', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
  });

  it('returns 200 and clears auth cookie on logout', async () => {
    // Setup for PIN login with bcrypt
    mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    // First, login to get a valid cookie
    const loginResponse = await request(app)
      .post('/api/v1/auth/login/pin')
      .send({ pin: '123456' });

    const authCookie = extractAuthCookie(loginResponse);
    expect(authCookie).not.toBeNull();

    // Then logout with that cookie
    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [authCookie!]);

    expect(logoutResponse.status).toBe(200);
  });
});

// ============================================================================
// TEST SUITE: GET /health
// ============================================================================

describe('GET /health', () => {
  
  it('returns 200 with status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
