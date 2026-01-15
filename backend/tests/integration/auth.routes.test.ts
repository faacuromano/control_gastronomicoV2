/**
 * Auth Routes Integration Tests
 */

import request from 'supertest';
import app from '../../src/app';

// Mock Prisma for integration tests
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    }
  }
}));

// Mock rate limiter to bypass during tests
jest.mock('../../src/middleware/rateLimit', () => ({
  authRateLimiter: (req: any, res: any, next: () => void) => next(),
  apiRateLimiter: (req: any, res: any, next: () => void) => next(),
  rateLimitLogger: (req: any, res: any, next: () => void) => next()
}));

import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

describe('Auth Routes', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    pinCode: '123456',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
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

  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async (password, hash) => {
        return password === 'correctpassword';
      });
    });

    it('should return 200 and token for valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'correctpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('name', 'Test User');
    });

    it('should return 401 for invalid password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 for missing email (validation error)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'anypassword'
        });

      // Auth returns 401 for any auth failure including validation
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/login/pin', () => {
    it('should return 200 and token for valid PIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '123456' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('role', 'ADMIN');
    });

    it('should return 401 for invalid PIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '999999' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 for PIN with wrong format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login/pin')
        .send({ pin: '12' }); // Too short

      // Auth returns 401 for any auth failure including validation
      expect(response.status).toBe(401);
    });
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
