"use strict";
/**
 * Auth Routes Integration Tests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
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
    authRateLimiter: (req, res, next) => next(),
    apiRateLimiter: (req, res, next) => next(),
    rateLimitLogger: (req, res, next) => next()
}));
const prisma_1 = require("../../src/lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
            jest.spyOn(bcryptjs_1.default, 'compare').mockImplementation(async (password, hash) => {
                return password === 'correctpassword';
            });
        });
        it('should return 200 and token for valid credentials', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const response = await (0, supertest_1.default)(app_1.default)
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
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: 'test@example.com',
                password: 'wrongpassword'
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });
        it('should return 401 for non-existent user', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: 'nonexistent@example.com',
                password: 'anypassword'
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });
        it('should return 401 for missing email (validation error)', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
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
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login/pin')
                .send({ pin: '123456' });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user).toHaveProperty('role', 'ADMIN');
        });
        it('should return 401 for invalid PIN', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login/pin')
                .send({ pin: '999999' });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });
        it('should return 401 for PIN with wrong format', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login/pin')
                .send({ pin: '12' }); // Too short
            // Auth returns 401 for any auth failure including validation
            expect(response.status).toBe(401);
        });
    });
    describe('GET /health', () => {
        it('should return 200 with status ok', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
        });
    });
});
//# sourceMappingURL=auth.routes.test.js.map