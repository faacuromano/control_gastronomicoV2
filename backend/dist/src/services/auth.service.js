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
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// =============================================================================
// JWT SECRET VALIDATION
// =============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
// SECURITY: Validate JWT_SECRET exists
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not defined. Server cannot start.');
}
// SECURITY: Validate JWT_SECRET entropy (minimum 32 characters)
if (JWT_SECRET.length < 32) {
    throw new Error(`CRITICAL: JWT_SECRET must be at least 32 characters for security. ` +
        `Current length: ${JWT_SECRET.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
}
// SECURITY: Warn if using obvious weak secrets
const WEAK_SECRETS = ['super_secret_key', 'secret', 'password', 'jwt_secret', 'changeme'];
if (WEAK_SECRETS.some(weak => JWT_SECRET.toLowerCase().includes(weak))) {
    logger_1.logger.warn('[SECURITY] JWT_SECRET appears to be a weak/default value. Change it in production!');
}
// =============================================================================
// ACCOUNT LOCKOUT CONFIGURATION
// =============================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
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
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
/**
 * Check if a user account is currently locked
 */
const isAccountLocked = (user) => {
    if (!user.lockedUntil)
        return false;
    return new Date() < user.lockedUntil;
};
/**
 * Handle failed login attempt - increment counter or lock account
 */
const handleFailedLogin = async (userId, currentAttempts) => {
    const newAttempts = currentAttempts + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: newAttempts,
                lockedUntil: lockUntil
            }
        });
        logger_1.logger.warn(`[SECURITY] Account locked for user ${userId} after ${newAttempts} failed attempts`);
    }
    else {
        // Just increment the counter
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts: newAttempts }
        });
    }
};
/**
 * Reset failed login attempts on successful login
 */
const resetFailedAttempts = async (userId) => {
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            failedLoginAttempts: 0,
            lockedUntil: null
        }
    });
};
/**
 * Generate JWT token with user payload
 */
const generateToken = (user, expiresIn) => {
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name,
        permissions: user.role.permissions || {}
    };
    // JWT_SECRET is validated at startup, so we can safely assert it's not undefined
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
};
// =============================================================================
// AUTH FUNCTIONS
// =============================================================================
const loginWithPin = async (pin) => {
    // 1. Validate Input
    const validation = LoginSchema.safeParse({ pin });
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid format', validation.error);
    }
    // 2. Find User by PIN (we need to check if exists before lockout check)
    const user = await prisma_1.prisma.user.findUnique({
        where: { pinCode: pin },
        include: { role: true }
    });
    // SECURITY: Don't reveal if PIN exists or not
    if (!user) {
        throw new errors_1.UnauthorizedError('Invalid credentials');
    }
    // 3. Check if account is locked
    if (isAccountLocked(user)) {
        const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        throw new errors_1.UnauthorizedError(`Cuenta bloqueada. Intenta nuevamente en ${remainingMinutes} minutos.`);
    }
    // 4. Check if user is active
    if (!user.isActive) {
        throw new errors_1.UnauthorizedError('Invalid credentials or inactive user');
    }
    // 5. Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
        await resetFailedAttempts(user.id);
    }
    // 6. Generate Token
    const token = generateToken(user, '12h');
    // 7. Return Session Data
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
        throw new errors_1.ValidationError('Invalid format', validation.error.issues);
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
        throw new errors_1.ConflictError('User with this email or PIN already exists');
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
    const token = generateToken(user, '24h');
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
        throw new errors_1.ValidationError('Invalid format', validation.error.issues);
    }
    // 2. Find User
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: data.email },
        include: { role: true }
    });
    // SECURITY: Don't reveal if email exists
    if (!user) {
        throw new errors_1.UnauthorizedError('Invalid credentials');
    }
    // 3. Check if account is locked
    if (isAccountLocked(user)) {
        const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        throw new errors_1.UnauthorizedError(`Cuenta bloqueada. Intenta nuevamente en ${remainingMinutes} minutos.`);
    }
    // 4. Check if user is active and has password
    if (!user.isActive || !user.passwordHash) {
        throw new errors_1.UnauthorizedError('Invalid credentials or inactive user');
    }
    // 5. Verify Password
    const isMatch = await bcryptjs_1.default.compare(data.password, user.passwordHash);
    if (!isMatch) {
        // SECURITY: Track failed attempts
        await handleFailedLogin(user.id, user.failedLoginAttempts);
        throw new errors_1.UnauthorizedError('Invalid credentials');
    }
    // 6. Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
        await resetFailedAttempts(user.id);
    }
    // 7. Generate Token
    const token = generateToken(user, '12h');
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