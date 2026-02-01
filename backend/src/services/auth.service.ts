import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

// =============================================================================
// SECURITY CONSTANTS
// =============================================================================
export const BCRYPT_SALT_ROUNDS = 10;

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
    tenantId: z.number().int().positive()
});

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    pinCode: z.string().length(6),
    roleId: z.number().int().positive(),
    tenantId: z.number().int().positive()
});

const PasswordLoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    tenantId: z.number().int().positive()
});

// Type for register data
interface RegisterData {
    email: string;
    password: string;
    name: string;
    pinCode: string;
    roleId: number;
    tenantId: number;
}

interface PasswordLoginData {
    email: string;
    password: string;
    tenantId: number;
}

const RegisterTenantSchema = z.object({
    businessName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    phone: z.string().optional()
});

interface RegisterTenantData {
    businessName: string;
    email: string;
    password: string;
    name: string;
    phone?: string;
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
// SAFE: auth-verified — userId comes from authenticated lookup by email/pin+tenantId
const handleFailedLogin = async (userId: number): Promise<void> => {
    // Atomic increment — no lost updates under concurrency
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            failedLoginAttempts: { increment: 1 }
        },
        select: { failedLoginAttempts: true }
    });

    // Check if we need to lock the account
    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

        await prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: lockUntil }
        });

        logger.warn(`[SECURITY] Account locked for user ${userId} after ${updated.failedLoginAttempts} failed attempts`);
    }
};

/**
 * Reset failed login attempts on successful login
 */
// SAFE: auth-verified — userId comes from authenticated lookup by email/pin+tenantId
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
const generateToken = (user: { id: number; name: string; tenantId: number; role: { name: string; permissions: unknown } }, expiresIn: string): string => {
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name,
        tenantId: user.tenantId,
        permissions: user.role.permissions || {}
    };

    // JWT_SECRET is validated at startup, so we can safely assert it's not undefined
    return jwt.sign(payload, JWT_SECRET!, { expiresIn } as jwt.SignOptions);
};

// =============================================================================
// REFRESH TOKEN FUNCTIONS
// =============================================================================

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_REFRESH_TOKENS_PER_USER = 5;

/**
 * Create a refresh token for a user.
 * Stores a SHA-256 hash in the database; returns the raw token to set in cookie.
 */
export const createRefreshToken = async (userId: number, tenantId: number): Promise<string> => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Enforce max tokens per user (evict oldest)
    const existingCount = await prisma.refreshToken.count({
        where: { userId, tenantId }
    });

    if (existingCount >= MAX_REFRESH_TOKENS_PER_USER) {
        const oldest = await prisma.refreshToken.findFirst({
            where: { userId, tenantId },
            orderBy: { createdAt: 'asc' }
        });
        if (oldest) {
            await prisma.refreshToken.delete({ where: { id: oldest.id } });
        }
    }

    await prisma.refreshToken.create({
        data: {
            tenantId,
            userId,
            token: hashedToken,
            expiresAt
        }
    });

    return rawToken;
};

/**
 * Validate and consume a refresh token.
 * Returns a new access token + new refresh token (rotation).
 */
export const refreshAccessToken = async (rawToken: string) => {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
        where: { token: hashedToken },
        include: {
            user: {
                include: { role: true }
            }
        }
    });

    if (!storedToken) {
        throw new UnauthorizedError('Invalid refresh token');
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedError('Refresh token expired');
    }

    // Check user is still active
    if (!storedToken.user.isActive) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedError('User account is inactive');
    }

    // Token rotation: delete old token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new access token
    const accessToken = generateToken(storedToken.user, '12h');

    // Generate new refresh token
    const newRefreshToken = await createRefreshToken(storedToken.userId, storedToken.tenantId);

    return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
            id: storedToken.user.id,
            name: storedToken.user.name,
            role: storedToken.user.role.name,
            tenantId: storedToken.user.tenantId,
            permissions: storedToken.user.role.permissions
        }
    };
};

/**
 * Revoke all refresh tokens for a user (used on logout).
 */
export const revokeRefreshTokens = async (userId: number, tenantId: number): Promise<void> => {
    await prisma.refreshToken.deleteMany({
        where: { userId, tenantId }
    });
};

// =============================================================================
// AUTH FUNCTIONS
// =============================================================================

export const loginWithPin = async (pin: string, tenantId: number) => {
    // 1. Validate Input
    const validation = LoginSchema.safeParse({ pin, tenantId });
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error);
    }

    // 2. Find all active users with a PIN in this tenant, then bcrypt-verify
    // NOTE: pinLookup O(1) optimization requires DB migration (pinLookup column).
    // Until migration is applied, we use the simpler scan approach.
    const candidates = await prisma.user.findMany({
        where: {
            tenantId,
            pinHash: { not: null },
            isActive: true
        },
        include: { role: true }
    });

    // 3. Compare PIN with each candidate's bcrypt hash
    let user = null;
    for (const candidate of candidates) {
        if (await bcrypt.compare(pin, candidate.pinHash!)) {
            user = candidate;
            break;
        }
    }

    // SECURITY: Don't reveal if PIN exists or not
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // 4. Check if account is locked
    if (isAccountLocked(user)) {
        const remainingMinutes = Math.ceil(
            (user.lockedUntil!.getTime() - Date.now()) / (1000 * 60)
        );
        throw new UnauthorizedError(
            `Cuenta bloqueada. Intenta nuevamente en ${remainingMinutes} minutos.`
        );
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
            tenantId: user.tenantId,
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

    // 2. Check for existing user by email
    const existingByEmail = await prisma.user.findFirst({
        where: { 
            email: data.email,
            tenantId: data.tenantId
        }
    });

    if (existingByEmail) {
        throw new ConflictError('User with this email already exists');
    }

    // 3. Check PIN uniqueness — scan all users with a PIN in this tenant
    // NOTE: pinLookup O(1) optimization deferred until DB migration is applied
    const existingUsers = await prisma.user.findMany({
        where: {
            tenantId: data.tenantId,
            pinHash: { not: null }
        }
    });
    for (const existingUser of existingUsers) {
        if (await bcrypt.compare(data.pinCode, existingUser.pinHash!)) {
            throw new ConflictError('PIN already in use');
        }
    }

    // 4. Hash Password and PIN
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const pinHash = await bcrypt.hash(data.pinCode, BCRYPT_SALT_ROUNDS);

    // 5. Create User
    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            pinHash,
            roleId: data.roleId,
            tenantId: data.tenantId
        },
        include: { role: true }
    });

    // 6. Generate Token
    const token = generateToken(user, '24h');

    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            tenantId: user.tenantId,
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
    const user = await prisma.user.findFirst({
        where: { 
            email: data.email,
            tenantId: data.tenantId
        },
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
        await handleFailedLogin(user.id);
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
            tenantId: user.tenantId,
            permissions: user.role.permissions
        },
        token
    };
};

export const registerTenant = async (data: RegisterTenantData) => {
    // 1. Validate Input
    const validation = RegisterTenantSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Generate slug/code from business name
    const code = data.businessName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);

    // 3. Create Tenant and Defaults in Transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create Tenant
        const tenant = await tx.tenant.create({
            data: {
                name: data.businessName,
                code,
                activeSubscription: true
            } as any // Cast to any to avoid type error if schema not regenerated
        });

        // Create TenantConfig
        await tx.tenantConfig.create({
            data: {
                tenantId: tenant.id,
                businessName: data.businessName,
                currencySymbol: '$'
            }
        });

        // Create Default Roles
        const adminRole = await tx.role.create({
            data: {
                tenantId: tenant.id,
                name: 'ADMIN',
                permissions: { all: true } // Full access
            }
        });

        await tx.role.create({
            data: {
                tenantId: tenant.id,
                name: 'WAITER',
                permissions: { 
                    order_create: true, 
                    order_read: true, 
                    table_read: true 
                }
            }
        });

        await tx.role.create({
            data: {
                tenantId: tenant.id,
                name: 'KITCHEN',
                permissions: { 
                    order_read: true, 
                    order_update_status: true 
                }
            }
        });

        // Create Admin User
        const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
        // Generate random PIN for fallback/convenience
        const pinCode = Math.floor(100000 + Math.random() * 900000).toString();
        const pinHash = await bcrypt.hash(pinCode, BCRYPT_SALT_ROUNDS);

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                roleId: adminRole.id,
                name: data.name,
                email: data.email,
                passwordHash,
                pinHash,
                isActive: true
            }
        });

        return { tenant, user, pinCode };
    });

    // 4. Generate Token
    const token = generateToken({
        id: result.user.id,
        name: result.user.name,
        tenantId: result.tenant.id,
        role: { name: 'ADMIN', permissions: { all: true } }
    }, '24h');

    return {
        success: true,
        tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            activeSubscription: (result.tenant as any).activeSubscription
        },
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            tenantId: result.tenant.id,
            generatedPin: result.pinCode // Return PIN once
        },
        token
    };
};
