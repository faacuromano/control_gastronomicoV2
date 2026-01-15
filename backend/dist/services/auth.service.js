"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithPassword = exports.register = exports.loginWithPin = void 0;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const LoginSchema = zod_1.z.object({
    pin: zod_1.z.string().length(6),
});
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().min(1),
    pinCode: zod_1.z.string().length(6),
    roleId: zod_1.z.number().int().positive()
});
const PasswordLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
const loginWithPin = async (pin) => {
    // 1. Validate Input
    const validation = LoginSchema.safeParse({ pin });
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error };
    }
    // 2. Find User
    const user = await prisma_1.prisma.user.findUnique({
        where: { pinCode: pin },
        include: { role: true }
    });
    if (!user || !user.isActive) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive user' };
    }
    // 3. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'super_secret_key', {
        expiresIn: '12h'
    });
    // 4. Return Session Data
    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};
exports.loginWithPin = loginWithPin;
const register = async (data) => {
    // 1. Validate Input
    const validation = RegisterSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error.issues };
    }
    // 2. Check for existing user
    const existingUser = await prisma_1.prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                { pinCode: data.pinCode }
            ]
        }
    });
    if (existingUser) {
        throw { code: 'USER_EXISTS', message: 'User with this email or PIN already exists' };
    }
    // 3. Hash Password
    const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
    // 4. Create User
    const user = await prisma_1.prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            pinCode: data.pinCode,
            roleId: data.roleId
        },
        include: { role: true }
    });
    // 5. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'super_secret_key', {
        expiresIn: '24h'
    });
    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};
exports.register = register;
const loginWithPassword = async (data) => {
    // 1. Validate Input
    const validation = PasswordLoginSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error.issues };
    }
    // 2. Find User
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: data.email },
        include: { role: true }
    });
    if (!user || !user.isActive || !user.passwordHash) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive user' };
    }
    // 3. Verify Password
    const isMatch = await bcryptjs_1.default.compare(data.password, user.passwordHash);
    if (!isMatch) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials' };
    }
    // 4. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'super_secret_key', {
        expiresIn: '12h'
    });
    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};
exports.loginWithPassword = loginWithPassword;
//# sourceMappingURL=auth.service.js.map