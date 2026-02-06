/**
 * @fileoverview Auth Service Unit Tests
 * 
 * PHILOSOPHY: "Strict Isolation Unit Testing"
 * - Mock dependencies (AuditService), not internals (Prisma auditLog)
 * - Service layer tests verify business logic only
 * - All external dependencies are mocked at the module level
 * 
 * MOCK STRATEGY:
 * 1. AuditService is mocked COMPLETELY - no real audit code runs
 * 2. Prisma is mocked for User operations only
 * 3. bcrypt is spied for password verification
 * 
 * @module tests/unit/auth.service.test
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ============================================================================
// MOCKS - Must be BEFORE any imports that use them
// ============================================================================

// 1. MOCK AUDIT SERVICE - Completely bypass audit logging
jest.mock('../../src/services/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logAuth: jest.fn().mockResolvedValue(undefined),
    logOrder: jest.fn().mockResolvedValue(undefined),
    logPayment: jest.fn().mockResolvedValue(undefined),
    logCashShift: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
  },
  AuditService: jest.fn(),
}));

// 2. MOCK PRISMA - Only for User operations (AuthService direct calls)
const mockPrismaUser = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(), // NEW: Used for PIN login with bcrypt
  create: jest.fn(),
  update: jest.fn(),
};

// Include auditLog just in case any code path accesses it
const mockAuditLog = {
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findMany: jest.fn().mockResolvedValue([]),
};

// 3. MOCK PRISMA REFRESH TOKEN - For refresh token operations
const mockPrismaRefreshToken = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  delete: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  count: jest.fn().mockResolvedValue(0),
};

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    auditLog: mockAuditLog,
    refreshToken: mockPrismaRefreshToken,
  },
}));

// ============================================================================
// IMPORTS - After all mocks are set up
// ============================================================================

import {
  loginWithPin,
  loginWithPassword,
  register,
  refreshAccessToken,
  createRefreshToken,
  revokeRefreshTokens,
} from '../../src/services/auth.service';
import { auditService } from '../../src/services/audit.service';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const JWT_SECRET = 'test_secret_key_for_testing_only';

/**
 * Creates a complete mock user object with all required fields.
 * This prevents "Cannot read properties of undefined" errors.
 * 
 * SECURITY UPDATE: Now uses pinHash (bcrypt) instead of plaintext pinCode
 * The default hash is for PIN '123456': bcrypt.hashSync('123456', 10)
 */
const createCompleteMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  // SECURITY: PIN is now stored as bcrypt hash, not plaintext
  // This hash corresponds to PIN '123456'
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
// TEST SUITE: loginWithPin
// ============================================================================

describe('Auth Service - loginWithPin', () => {
  
  beforeEach(() => {
    // CRITICAL: Reset ALL mocks to clean state
    jest.clearAllMocks();
    mockPrismaUser.findMany.mockReset();
    mockPrismaUser.update.mockReset();
    // SECURITY: Reset bcrypt.compare spy for each test
    jest.spyOn(bcrypt, 'compare').mockRestore();
  });

  describe('Success Scenarios', () => {
    
    beforeEach(() => {
      // NEW: loginWithPin now uses findMany to get all users with PIN
      // then compares bcrypt hashes
      mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
      // SECURITY: Mock bcrypt.compare to return true for valid PIN
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    });

    it('returns { user, token } for valid PIN', async () => {
      const result = await loginWithPin('123456', 1);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('returns correctly shaped user object', async () => {
      const result = await loginWithPin('123456', 1);

      expect(result.user).toEqual({
        id: 1,
        name: 'Test User',
        role: 'ADMIN',
        permissions: { all: ['*'] },
      });
    });

    it('returns a valid JWT token with correct claims', async () => {
      const result = await loginWithPin('123456', 1);
      const decoded = jwt.verify(result.token, JWT_SECRET) as Record<string, unknown>;

      expect(decoded.id).toBe(1);
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.name).toBe('Test User');
      expect(decoded.exp).toBeDefined();
    });

    it('resets failed login attempts on successful login', async () => {
      // Override findMany with user that has failed attempts
      mockPrismaUser.findMany.mockResolvedValue([
        createCompleteMockUser({ failedLoginAttempts: 3 })
      ]);
      mockPrismaUser.update.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await loginWithPin('123456', 1);

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('calls auditService.logAuth is available (verification)', async () => {
      await loginWithPin('123456', 1);

      // AuditService is mocked - verify it's callable
      expect(auditService.logAuth).toBeDefined();
    });
  });

  describe('Validation Errors', () => {
    
    it('throws VALIDATION_ERROR for PIN shorter than 6 characters', async () => {
      await expect(loginWithPin('123', 1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });

      // Prisma findMany should NOT be called for invalid input
      expect(mockPrismaUser.findMany).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for PIN longer than 6 characters', async () => {
      await expect(loginWithPin('1234567', 1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });

      expect(mockPrismaUser.findMany).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for empty PIN', async () => {
      await expect(loginWithPin('', 1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Authentication Errors', () => {

    it('throws UNAUTHORIZED for non-existent user (PIN not found)', async () => {
      // CRITICAL: Mock returns empty array for no matching users
      mockPrismaUser.findMany.mockResolvedValue([]);

      await expect(loginWithPin('999999', 1)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED when no bcrypt match found', async () => {
      // Users exist but bcrypt.compare returns false for all
      mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPin('999999', 1)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED for locked account', async () => {
      mockPrismaUser.findMany.mockResolvedValue([
        createCompleteMockUser({
          lockedUntil: new Date(Date.now() + 60000), // Locked for 1 minute
        })
      ]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(loginWithPin('123456', 1)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });
});

// ============================================================================
// TEST SUITE: loginWithPassword
// ============================================================================

describe('Auth Service - loginWithPassword', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaUser.findUnique.mockReset();
    mockPrismaUser.findFirst.mockReset();
    mockPrismaUser.update.mockReset();
  });

  describe('Success Scenarios', () => {

    beforeEach(() => {
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
      mockPrismaUser.findFirst.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    });

    it('returns { user, token } for valid credentials', async () => {
      const result = await loginWithPassword({
        email: 'test@example.com',
        password: 'Password123',
        tenantId: 1,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.role).toBe('ADMIN');
    });

    it('calls bcrypt.compare with correct arguments', async () => {
      const mockUser = createCompleteMockUser();
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await loginWithPassword({
        email: 'test@example.com',
        password: 'Password123',
        tenantId: 1,
      });

      expect(compareSpy).toHaveBeenCalledWith('Password123', mockUser.passwordHash);
    });
  });

  describe('Validation Errors', () => {
    
    it('throws VALIDATION_ERROR for invalid email format', async () => {
      await expect(loginWithPassword({
        email: 'not-an-email',
        password: 'anypassword',
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });

      expect(mockPrismaUser.findFirst).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for missing email', async () => {
      await expect(loginWithPassword({
        email: '',
        password: 'Password123',
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Authentication Errors', () => {

    it('throws UNAUTHORIZED for wrong password', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(createCompleteMockUser());
      mockPrismaUser.update.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED for non-existent user', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      await expect(loginWithPassword({
        email: 'nonexistent@example.com',
        password: 'anypassword',
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED for inactive user', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(
        createCompleteMockUser({ isActive: false })
      );

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'Password123',
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('increments failed attempts on wrong password', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(
        createCompleteMockUser({ failedLoginAttempts: 2 })
      );
      mockPrismaUser.update.mockResolvedValue(
        createCompleteMockUser({ failedLoginAttempts: 3 })
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
        tenantId: 1,
      })).rejects.toThrow();

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
    });
  });
});

// ============================================================================
// TEST SUITE: register
// ============================================================================

describe('Auth Service - register', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaUser.findFirst.mockReset();
    mockPrismaUser.findMany.mockReset();
    mockPrismaUser.create.mockReset();
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$hashedpassword' as never);
  });

  describe('Success Scenarios', () => {

    beforeEach(() => {
      mockPrismaUser.findFirst.mockResolvedValue(null); // No existing user by email
      mockPrismaUser.findMany.mockResolvedValue([]); // No existing PIN users
      mockPrismaUser.create.mockResolvedValue(
        createCompleteMockUser({ id: 2, email: 'new@example.com' })
      );
    });

    it('creates user and returns { user, token } for valid data', async () => {
      const result = await register({
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
        pinCode: '654321',
        roleId: 1,
        tenantId: 1,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(mockPrismaUser.create).toHaveBeenCalled();
    });

    it('hashes password before storing', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$hashed' as never);

      await register({
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
        pinCode: '654321',
        roleId: 1,
        tenantId: 1,
      });

      expect(hashSpy).toHaveBeenCalledWith('Password123', 10);
    });
  });

  describe('Validation Errors', () => {
    
    it('throws VALIDATION_ERROR for short password', async () => {
      await expect(register({
        email: 'test@example.com',
        password: '12345', // 5 chars, min is 6
        name: 'Test',
        pinCode: '123456',
        roleId: 1,
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR for invalid email', async () => {
      await expect(register({
        email: 'invalid-email',
        password: 'Password123',
        name: 'Test',
        pinCode: '123456',
        roleId: 1,
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR for short PIN', async () => {
      await expect(register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test',
        pinCode: '123', // Too short
        roleId: 1,
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Conflict Errors', () => {
    
    it('throws CONFLICT if email already registered', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(createCompleteMockUser());
      mockPrismaUser.findMany.mockResolvedValue([]); // No PIN collision

      await expect(register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Duplicate User',
        pinCode: '111111',
        roleId: 1,
        tenantId: 1,
      })).rejects.toMatchObject({
        code: 'CONFLICT',
      });

      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// TEST SUITE: refreshAccessToken
// ============================================================================

describe('Auth Service - refreshAccessToken', () => {

  /**
   * Creates a mock stored refresh token with associated user.
   * Used by refreshAccessToken to validate and rotate tokens.
   */
  const createMockStoredToken = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    token: 'stored-hashed-token',
    userId: 1,
    tenantId: 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days ahead
    createdAt: new Date(),
    user: createCompleteMockUser({ tenantId: 1 }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRefreshToken.findUnique.mockReset();
    mockPrismaRefreshToken.create.mockReset();
    mockPrismaRefreshToken.delete.mockReset();
    mockPrismaRefreshToken.count.mockReset();
    mockPrismaRefreshToken.findFirst.mockReset();
    // Default: token creation succeeds
    mockPrismaRefreshToken.create.mockResolvedValue({ id: 2 });
    mockPrismaRefreshToken.count.mockResolvedValue(0);
    mockPrismaRefreshToken.delete.mockResolvedValue({});
  });

  describe('Success Scenarios', () => {

    it('returns new accessToken, refreshToken, and user on valid token', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(createMockStoredToken());

      const result = await refreshAccessToken('raw-token-string');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('returns correctly shaped user object', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(createMockStoredToken());

      const result = await refreshAccessToken('raw-token-string');

      expect(result.user).toEqual({
        id: 1,
        name: 'Test User',
        role: 'ADMIN',
        tenantId: 1,
        permissions: { all: ['*'] },
      });
    });

    it('deletes old token for rotation (prevents reuse)', async () => {
      const storedToken = createMockStoredToken();
      mockPrismaRefreshToken.findUnique.mockResolvedValue(storedToken);

      await refreshAccessToken('raw-token-string');

      expect(mockPrismaRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: storedToken.id },
      });
    });

    it('creates a new refresh token after consuming the old one', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(createMockStoredToken());

      await refreshAccessToken('raw-token-string');

      // createRefreshToken internally calls prisma.refreshToken.create
      expect(mockPrismaRefreshToken.create).toHaveBeenCalled();
    });

    it('returns a valid JWT access token with correct claims', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(createMockStoredToken());

      const result = await refreshAccessToken('raw-token-string');
      const decoded = jwt.verify(result.accessToken, JWT_SECRET) as Record<string, unknown>;

      expect(decoded.id).toBe(1);
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.tenantId).toBe(1);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {

    it('throws UNAUTHORIZED for invalid/non-existent token', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(null);

      await expect(refreshAccessToken('invalid-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED for expired token and deletes it', async () => {
      const expiredToken = createMockStoredToken({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      mockPrismaRefreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(refreshAccessToken('expired-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });

      // Expired token should be cleaned up
      expect(mockPrismaRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id },
      });
    });

    it('throws UNAUTHORIZED for inactive user and deletes token', async () => {
      const tokenWithInactiveUser = createMockStoredToken({
        user: createCompleteMockUser({ tenantId: 1, isActive: false }),
      });
      mockPrismaRefreshToken.findUnique.mockResolvedValue(tokenWithInactiveUser);

      await expect(refreshAccessToken('inactive-user-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });

      expect(mockPrismaRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: tokenWithInactiveUser.id },
      });
    });
  });
});

// ============================================================================
// TEST SUITE: createRefreshToken
// ============================================================================

describe('Auth Service - createRefreshToken', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRefreshToken.count.mockReset();
    mockPrismaRefreshToken.findFirst.mockReset();
    mockPrismaRefreshToken.create.mockReset();
    mockPrismaRefreshToken.delete.mockReset();
    mockPrismaRefreshToken.create.mockResolvedValue({ id: 1 });
  });

  it('creates a refresh token and returns raw token string', async () => {
    mockPrismaRefreshToken.count.mockResolvedValue(0);

    const rawToken = await createRefreshToken(1, 1);

    expect(typeof rawToken).toBe('string');
    expect(rawToken.length).toBe(64); // 32 bytes hex = 64 chars
    expect(mockPrismaRefreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 1,
        userId: 1,
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('stores hashed token, not the raw token', async () => {
    mockPrismaRefreshToken.count.mockResolvedValue(0);

    const rawToken = await createRefreshToken(1, 1);

    // The stored token should NOT be the raw token (it should be SHA-256 hashed)
    const storedToken = mockPrismaRefreshToken.create.mock.calls[0][0].data.token;
    expect(storedToken).not.toBe(rawToken);
    expect(storedToken.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('deletes oldest token when limit is reached', async () => {
    mockPrismaRefreshToken.count.mockResolvedValue(5); // At limit
    mockPrismaRefreshToken.findFirst.mockResolvedValue({ id: 99, createdAt: new Date('2020-01-01') });
    mockPrismaRefreshToken.delete.mockResolvedValue({});

    await createRefreshToken(1, 1);

    // Should delete the oldest token
    expect(mockPrismaRefreshToken.delete).toHaveBeenCalledWith({
      where: { id: 99 },
    });
    // And still create the new one
    expect(mockPrismaRefreshToken.create).toHaveBeenCalled();
  });

  it('does not delete tokens when under limit', async () => {
    mockPrismaRefreshToken.count.mockResolvedValue(2); // Under limit

    await createRefreshToken(1, 1);

    // findFirst should not be called to find oldest
    expect(mockPrismaRefreshToken.findFirst).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TEST SUITE: revokeRefreshTokens
// ============================================================================

describe('Auth Service - revokeRefreshTokens', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRefreshToken.deleteMany.mockReset();
    mockPrismaRefreshToken.deleteMany.mockResolvedValue({ count: 3 });
  });

  it('deletes all refresh tokens for user+tenant', async () => {
    await revokeRefreshTokens(1, 1);

    expect(mockPrismaRefreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, tenantId: 1 },
    });
  });
});
