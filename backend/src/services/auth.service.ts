import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

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
    throw new Error(
        `CRITICAL: JWT_SECRET must be at least 32 characters for security. ` +
        `Current length: ${JWT_SECRET.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
}

// SECURITY: Warn if using obvious weak secrets
const WEAK_SECRETS = ['super_secret_key', 'secret', 'password', 'jwt_secret', 'changeme'];
if (WEAK_SECRETS.some(weak => JWT_SECRET.toLowerCase().includes(weak))) {
    logger.warn('[SECURITY] JWT_SECRET appears to be a weak/default value. Change it in production!');
}

// =============================================================================
// ACCOUNT LOCKOUT CONFIGURATION
// =============================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const LoginSchema = z.object({
    pin: z.string().length(6),
});

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    pinCode: z.string().length(6),
    roleId: z.number().int().positive()
});

const PasswordLoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

// Type for register data
interface RegisterData {
    email: string;
    password: string;
    name: string;
    pinCode: string;
    roleId: number;
}

// Type for password login data
interface PasswordLoginData {
    email: string;
    password: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a user account is currently locked
 */
const isAccountLocked = (user: { lockedUntil: Date | null }): boolean => {
    if (!user.lockedUntil) return false;
    return new Date() < user.lockedUntil;
};

/**
 * Handle failed login attempt - increment counter or lock account
 */
const handleFailedLogin = async (userId: number, currentAttempts: number): Promise<void> => {
    const newAttempts = currentAttempts + 1;
    
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        
        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: newAttempts,
                lockedUntil: lockUntil
            }
        });
        
        logger.warn(`[SECURITY] Account locked for user ${userId} after ${newAttempts} failed attempts`);
    } else {
        // Just increment the counter
        await prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts: newAttempts }
        });
    }
};

/**
 * Reset failed login attempts on successful login
 */
const resetFailedAttempts = async (userId: number): Promise<void> => {
    await prisma.user.update({
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
const generateToken = (user: { id: number; name: string; role: { name: string; permissions: unknown } }, expiresIn: string): string => {
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name,
        permissions: user.role.permissions || {}
    };

    // JWT_SECRET is validated at startup, so we can safely assert it's not undefined
    return jwt.sign(payload, JWT_SECRET!, { expiresIn } as jwt.SignOptions);
};

// =============================================================================
// AUTH FUNCTIONS
// =============================================================================

export const loginWithPin = async (pin: string) => {
    // 1. Validate Input
    const validation = LoginSchema.safeParse({ pin });
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error);
    }

    // 2. Find User by PIN (we need to check if exists before lockout check)
    const user = await prisma.user.findUnique({
        where: { pinCode: pin },
        include: { role: true }
    });

    // SECURITY: Don't reveal if PIN exists or not
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Check if account is locked
    if (isAccountLocked(user)) {
        const remainingMinutes = Math.ceil(
            (user.lockedUntil!.getTime() - Date.now()) / (1000 * 60)
        );
        throw new UnauthorizedError(
            `Cuenta bloqueada. Intenta nuevamente en ${remainingMinutes} minutos.`
        );
    }

    // 4. Check if user is active
    if (!user.isActive) {
        throw new UnauthorizedError('Invalid credentials or inactive user');
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

export const register = async (data: RegisterData) => {
    // 1. Validate Input
    const validation = RegisterSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Check for existing user
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                { pinCode: data.pinCode }
            ]
        }
    });

    if (existingUser) {
        throw new ConflictError('User with this email or PIN already exists');
    }

    // 3. Hash Password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 4. Create User
    const user = await prisma.user.create({
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

export const loginWithPassword = async (data: PasswordLoginData) => {
    // 1. Validate Input
    const validation = PasswordLoginSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Find User
    const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: { role: true }
    });

    // SECURITY: Don't reveal if email exists
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Check if account is locked
    if (isAccountLocked(user)) {
        const remainingMinutes = Math.ceil(
            (user.lockedUntil!.getTime() - Date.now()) / (1000 * 60)
        );
        throw new UnauthorizedError(
            `Cuenta bloqueada. Intenta nuevamente en ${remainingMinutes} minutos.`
        );
    }

    // 4. Check if user is active and has password
    if (!user.isActive || !user.passwordHash) {
        throw new UnauthorizedError('Invalid credentials or inactive user');
    }

    // 5. Verify Password
    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
        // SECURITY: Track failed attempts
        await handleFailedLogin(user.id, user.failedLoginAttempts);
        throw new UnauthorizedError('Invalid credentials');
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
