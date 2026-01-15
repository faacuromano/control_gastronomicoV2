"use strict";
/**
 * Auth Service Unit Tests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
const prisma_1 = require("../../src/lib/prisma");
const auth_service_1 = require("../../src/services/auth.service");
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
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const result = await (0, auth_service_1.loginWithPin)('123456');
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('token');
            expect(result.user.id).toBe(1);
            expect(result.user.name).toBe('Test User');
            expect(result.user.role).toBe('ADMIN');
        });
        it('should throw error for invalid PIN format', async () => {
            await expect((0, auth_service_1.loginWithPin)('123')).rejects.toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
        });
        it('should throw error for non-existent user', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(null);
            await expect((0, auth_service_1.loginWithPin)('999999')).rejects.toEqual(expect.objectContaining({ code: 'AUTH_FAILED' }));
        });
        it('should throw error for inactive user', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue({
                ...mockUser,
                isActive: false
            });
            await expect((0, auth_service_1.loginWithPin)('123456')).rejects.toEqual(expect.objectContaining({ code: 'AUTH_FAILED' }));
        });
        it('should generate a valid JWT token', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const result = await (0, auth_service_1.loginWithPin)('123456');
            const decoded = jsonwebtoken_1.default.verify(result.token, 'test_secret_key_for_testing_only');
            expect(decoded).toHaveProperty('id', 1);
            expect(decoded).toHaveProperty('role', 'ADMIN');
            expect(decoded).toHaveProperty('name', 'Test User');
        });
    });
    describe('loginWithPassword', () => {
        beforeEach(() => {
            // Mock bcrypt.compare
            jest.spyOn(bcryptjs_1.default, 'compare').mockImplementation(async (password, hash) => {
                return password === 'validpassword';
            });
        });
        it('should return user and token for valid credentials', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            const result = await (0, auth_service_1.loginWithPassword)({
                email: 'test@example.com',
                password: 'validpassword'
            });
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('token');
            expect(result.user.name).toBe('Test User'); // Name is exposed in response
            expect(result.user.role).toBe('ADMIN');
        });
        it('should throw error for invalid email format', async () => {
            await expect((0, auth_service_1.loginWithPassword)({
                email: 'invalid-email',
                password: 'anypassword'
            })).rejects.toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
        });
        it('should throw error for wrong password', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(mockUser);
            await expect((0, auth_service_1.loginWithPassword)({
                email: 'test@example.com',
                password: 'wrongpassword'
            })).rejects.toEqual(expect.objectContaining({ code: 'AUTH_FAILED' }));
        });
        it('should throw error for non-existent user', async () => {
            prisma_1.prisma.user.findUnique.mockResolvedValue(null);
            await expect((0, auth_service_1.loginWithPassword)({
                email: 'nonexistent@example.com',
                password: 'anypassword'
            })).rejects.toEqual(expect.objectContaining({ code: 'AUTH_FAILED' }));
        });
    });
    describe('register', () => {
        beforeEach(() => {
            jest.spyOn(bcryptjs_1.default, 'hash').mockResolvedValue('$2a$10$hashedpassword');
        });
        it('should create user and return token for valid data', async () => {
            prisma_1.prisma.user.findFirst.mockResolvedValue(null);
            prisma_1.prisma.user.create.mockResolvedValue(mockUser);
            const result = await (0, auth_service_1.register)({
                email: 'new@example.com',
                password: 'password123',
                name: 'New User',
                pinCode: '654321',
                roleId: 1
            });
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('token');
            expect(prisma_1.prisma.user.create).toHaveBeenCalled();
        });
        it('should throw error if user already exists', async () => {
            prisma_1.prisma.user.findFirst.mockResolvedValue(mockUser);
            await expect((0, auth_service_1.register)({
                email: 'test@example.com',
                password: 'password123',
                name: 'Duplicate User',
                pinCode: '123456',
                roleId: 1
            })).rejects.toEqual(expect.objectContaining({ code: 'USER_EXISTS' }));
        });
        it('should throw error for invalid registration data', async () => {
            await expect((0, auth_service_1.register)({
                email: 'invalid-email',
                password: '123', // Too short
                name: '',
                pinCode: '12', // Too short
                roleId: -1
            })).rejects.toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
        });
    });
});
//# sourceMappingURL=auth.service.test.js.map