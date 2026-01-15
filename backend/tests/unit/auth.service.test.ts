/**
 * Auth Service Unit Tests
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    }
  }
}));

import { prisma } from '../../src/lib/prisma';
import { loginWithPin, loginWithPassword, register } from '../../src/services/auth.service';

describe('Auth Service', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    pinCode: '123456',
    passwordHash: '$2a$10$hashedpassword',
    isActive: true,
    role: {
      id: 1,
      name: 'ADMIN',
      permissions: { all: true }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginWithPin', () => {
    it('should return user and token for valid PIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await loginWithPin('123456');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe(1);
      expect(result.user.name).toBe('Test User');
      expect(result.user.role).toBe('ADMIN');
    });

    it('should throw error for invalid PIN format', async () => {
      await expect(loginWithPin('123')).rejects.toEqual(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('should throw error for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(loginWithPin('999999')).rejects.toEqual(
        expect.objectContaining({ code: 'AUTH_FAILED' })
      );
    });

    it('should throw error for inactive user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false
      });

      await expect(loginWithPin('123456')).rejects.toEqual(
        expect.objectContaining({ code: 'AUTH_FAILED' })
      );
    });

    it('should generate a valid JWT token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await loginWithPin('123456');
      const decoded = jwt.verify(result.token, 'test_secret_key_for_testing_only') as any;

      expect(decoded).toHaveProperty('id', 1);
      expect(decoded).toHaveProperty('role', 'ADMIN');
      expect(decoded).toHaveProperty('name', 'Test User');
    });
  });

  describe('loginWithPassword', () => {
    beforeEach(() => {
      // Mock bcrypt.compare
      jest.spyOn(bcrypt, 'compare').mockImplementation(async (password, hash) => {
        return password === 'validpassword';
      });
    });

    it('should return user and token for valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await loginWithPassword({
        email: 'test@example.com',
        password: 'validpassword'
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.name).toBe('Test User'); // Name is exposed in response
      expect(result.user.role).toBe('ADMIN');
    });

    it('should throw error for invalid email format', async () => {
      await expect(loginWithPassword({
        email: 'invalid-email',
        password: 'anypassword'
      })).rejects.toEqual(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('should throw error for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(loginWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toEqual(
        expect.objectContaining({ code: 'AUTH_FAILED' })
      );
    });

    it('should throw error for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(loginWithPassword({
        email: 'nonexistent@example.com',
        password: 'anypassword'
      })).rejects.toEqual(
        expect.objectContaining({ code: 'AUTH_FAILED' })
      );
    });
  });

  describe('register', () => {
    beforeEach(() => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$hashedpassword' as never);
    });

    it('should create user and return token for valid data', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        pinCode: '654321',
        roleId: 1
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Duplicate User',
        pinCode: '123456',
        roleId: 1
      })).rejects.toEqual(
        expect.objectContaining({ code: 'USER_EXISTS' })
      );
    });

    it('should throw error for invalid registration data', async () => {
      await expect(register({
        email: 'invalid-email',
        password: '123', // Too short
        name: '',
        pinCode: '12', // Too short
        roleId: -1
      })).rejects.toEqual(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });
});
