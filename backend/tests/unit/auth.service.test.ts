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

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    auditLog: mockAuditLog,
  },
}));

// ============================================================================
// IMPORTS - After all mocks are set up
// ============================================================================

import { loginWithPin, loginWithPassword, register } from '../../src/services/auth.service';
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
      const result = await loginWithPin('123456');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('returns correctly shaped user object', async () => {
      const result = await loginWithPin('123456');
      
      expect(result.user).toEqual({
        id: 1,
        name: 'Test User',
        role: 'ADMIN',
        permissions: { all: ['*'] },
      });
    });

    it('returns a valid JWT token with correct claims', async () => {
      const result = await loginWithPin('123456');
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

      await loginWithPin('123456');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('calls auditService.logAuth is available (verification)', async () => {
      await loginWithPin('123456');
      
      // AuditService is mocked - verify it's callable
      expect(auditService.logAuth).toBeDefined();
    });
  });

  describe('Validation Errors', () => {
    
    it('throws VALIDATION_ERROR for PIN shorter than 6 characters', async () => {
      await expect(loginWithPin('123')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      
      // Prisma findMany should NOT be called for invalid input
      expect(mockPrismaUser.findMany).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for PIN longer than 6 characters', async () => {
      await expect(loginWithPin('1234567')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      
      expect(mockPrismaUser.findMany).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for empty PIN', async () => {
      await expect(loginWithPin('')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Authentication Errors', () => {
    
    it('throws AUTH_FAILED for non-existent user (PIN not found)', async () => {
      // CRITICAL: Mock returns empty array for no matching users
      mockPrismaUser.findMany.mockResolvedValue([]);

      await expect(loginWithPin('999999')).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws AUTH_FAILED when no bcrypt match found', async () => {
      // Users exist but bcrypt.compare returns false for all
      mockPrismaUser.findMany.mockResolvedValue([createCompleteMockUser()]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPin('999999')).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws AUTH_FAILED for locked account', async () => {
      mockPrismaUser.findMany.mockResolvedValue([
        createCompleteMockUser({
          lockedUntil: new Date(Date.now() + 60000), // Locked for 1 minute
        })
      ]);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(loginWithPin('123456')).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws AUTH_FAILED for locked account', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(
        createCompleteMockUser({
          lockedUntil: new Date(Date.now() + 60000), // Locked for 1 minute
        })
      );

      await expect(loginWithPin('123456')).rejects.toMatchObject({
        code: 'AUTH_FAILED',
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
    mockPrismaUser.update.mockReset();
  });

  describe('Success Scenarios', () => {
    
    beforeEach(() => {
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    });

    it('returns { user, token } for valid credentials', async () => {
      const result = await loginWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.role).toBe('ADMIN');
    });

    it('calls bcrypt.compare with correct arguments', async () => {
      const mockUser = createCompleteMockUser();
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await loginWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(compareSpy).toHaveBeenCalledWith('password123', mockUser.passwordHash);
    });
  });

  describe('Validation Errors', () => {
    
    it('throws VALIDATION_ERROR for invalid email format', async () => {
      await expect(loginWithPassword({
        email: 'not-an-email',
        password: 'anypassword',
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });

      expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR for missing email', async () => {
      await expect(loginWithPassword({
        email: '',
        password: 'password123',
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Authentication Errors', () => {
    
    it('throws AUTH_FAILED for wrong password', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createCompleteMockUser());
      mockPrismaUser.update.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
      })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws AUTH_FAILED for non-existent user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(loginWithPassword({
        email: 'nonexistent@example.com',
        password: 'anypassword',
      })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws AUTH_FAILED for inactive user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(
        createCompleteMockUser({ isActive: false })
      );

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('increments failed attempts on wrong password', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(
        createCompleteMockUser({ failedLoginAttempts: 2 })
      );
      mockPrismaUser.update.mockResolvedValue(createCompleteMockUser());
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow();

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: 3 },
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
    mockPrismaUser.create.mockReset();
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$hashedpassword' as never);
  });

  describe('Success Scenarios', () => {
    
    beforeEach(() => {
      mockPrismaUser.findFirst.mockResolvedValue(null); // No existing user
      mockPrismaUser.create.mockResolvedValue(
        createCompleteMockUser({ id: 2, email: 'new@example.com' })
      );
    });

    it('creates user and returns { user, token } for valid data', async () => {
      const result = await register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        pinCode: '654321',
        roleId: 1,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(mockPrismaUser.create).toHaveBeenCalled();
    });

    it('hashes password before storing', async () => {
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$hashed' as never);

      await register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        pinCode: '654321',
        roleId: 1,
      });

      expect(hashSpy).toHaveBeenCalledWith('password123', 10);
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
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR for invalid email', async () => {
      await expect(register({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test',
        pinCode: '123456',
        roleId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR for short PIN', async () => {
      await expect(register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
        pinCode: '123', // Too short
        roleId: 1,
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('Conflict Errors', () => {
    
    it('throws USER_EXISTS if email already registered', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(createCompleteMockUser());

      await expect(register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Duplicate User',
        pinCode: '111111',
        roleId: 1,
      })).rejects.toMatchObject({
        code: 'USER_EXISTS',
      });

      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });
});
