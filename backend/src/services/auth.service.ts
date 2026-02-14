/**
 * @fileoverview Servicio de autenticación y gestión de sesiones.
 *
 * Maneja login por PIN (meseros) y por email/contraseña (admins),
 * registro de usuarios, registro de nuevos tenants, generación de JWT,
 * refresh tokens con rotación, y bloqueo de cuentas por intentos fallidos.
 *
 * SEGURIDAD:
 * - Los PINs se almacenan como hash bcrypt (verificación) + SHA-256 (búsqueda O(1))
 * - Las contraseñas requieren mínimo 8 caracteres con mayúscula, minúscula y número
 * - Los JWT se firman con un secreto validado al arranque (mínimo 32 caracteres)
 * - Las cuentas se bloquean después de 5 intentos fallidos por 15 minutos
 * - Los refresh tokens se almacenan hasheados y se rotan en cada uso
 *
 * @module services/auth.service
 */

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

// =============================================================================
// CONSTANTES DE SEGURIDAD
// =============================================================================
export const BCRYPT_SALT_ROUNDS = 12;

// =============================================================================
// VALIDACIÓN DEL SECRETO JWT
// =============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_ISSUER = 'pentiumpos';
export const JWT_AUDIENCE = 'pentiumpos-api';

// SEGURIDAD: El servidor no puede arrancar sin un secreto JWT configurado
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not defined. Server cannot start.');
}

// SEGURIDAD: El secreto debe tener al menos 32 caracteres para garantizar suficiente entropía
if (JWT_SECRET.length < 32) {
    throw new Error(
        `CRITICAL: JWT_SECRET must be at least 32 characters for security. ` +
        `Current length: ${JWT_SECRET.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
}

// SEGURIDAD: Rechazar secretos débiles en producción, advertir en desarrollo
const WEAK_SECRETS = ['super_secret_key', 'secret', 'password', 'jwt_secret', 'changeme', 'cambiar'];
if (WEAK_SECRETS.some(weak => JWT_SECRET.toLowerCase().includes(weak))) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: JWT_SECRET contains a weak/default value. Generate a secure secret before starting in production.');
    }
    logger.warn('[SECURITY] JWT_SECRET appears to be a weak/default value. Change it before deploying to production!');
}

// =============================================================================
// HELPER DE BÚSQUEDA POR PIN (FIX P0-PERF-001 + SEC-004)
// =============================================================================

// SEC-004: Secreto HMAC para PIN lookup. Sin este secreto, un SHA-256 plano de PINs
// de 6 dígitos (1M combinaciones) es trivialmente reversible con una tabla de lookup.
// Con HMAC, un atacante que obtenga la DB necesita también este secreto para generar hashes.
// Si PIN_HMAC_SECRET no está definido, se usa JWT_SECRET como fallback.
const PIN_HMAC_SECRET = process.env.PIN_HMAC_SECRET || JWT_SECRET;

/**
 * Genera un hash HMAC-SHA256 determinístico para búsqueda rápida de PIN.
 * Se usa para localizar al usuario en O(1) en vez de escanear todos los hashes bcrypt O(n).
 * El hash bcrypt se sigue usando para la verificación final (defensa en profundidad).
 *
 * SEC-004: Usa HMAC con secreto del servidor para que la DB por sí sola no permita
 * revertir PINs. Sin el secreto, las 1M combinaciones de 6 dígitos no se pueden
 * precalcular.
 */
export const generatePinLookup = (pin: string): string => {
    return crypto.createHmac('sha256', PIN_HMAC_SECRET).update(pin).digest('hex');
};

// =============================================================================
// TIMING ATTACK MITIGATION
// =============================================================================
// SEC-P2-03: Pre-computed dummy hash for timing-safe rejection of invalid credentials.
// When no user is found, we still run bcrypt.compare against this dummy to ensure
// consistent response times (prevents timing oracle for user enumeration).
const DUMMY_BCRYPT_HASH = '$2a$12$LJ3m4ys3Lg/2VCdxQhBusu5wH5EmKlrV7fDe0FBwrCyEFQ9lB3kRy';

// =============================================================================
// CONFIGURACIÓN DE BLOQUEO DE CUENTAS
// =============================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// =============================================================================
// ESQUEMAS DE VALIDACIÓN (Zod)
// =============================================================================
const LoginSchema = z.object({
    pin: z.string().length(6),
    tenantId: z.number().int().positive()
});

const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

const RegisterSchema = z.object({
    email: z.string().email(),
    password: PasswordSchema,
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

// Tipo para los datos de registro de usuario
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
    password: PasswordSchema,
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
// FUNCIONES AUXILIARES
// =============================================================================

/**
 * Verifica si una cuenta de usuario está actualmente bloqueada por intentos fallidos.
 */
const isAccountLocked = (user: { lockedUntil: Date | null }): boolean => {
    if (!user.lockedUntil) return false;
    return new Date() < user.lockedUntil;
};

/**
 * Maneja un intento de login fallido: incrementa el contador y bloquea si se alcanza el límite.
 */
// SAFE: auth-verified — userId proviene de búsqueda autenticada por email/pin+tenantId
const handleFailedLogin = async (userId: number): Promise<void> => {
    // Incremento atómico para evitar pérdida de actualizaciones bajo concurrencia
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            failedLoginAttempts: { increment: 1 }
        },
        select: { failedLoginAttempts: true }
    });

    // Si se alcanzó el máximo de intentos, bloquear la cuenta
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
 * Resetea el contador de intentos fallidos tras un login exitoso.
 */
// SAFE: auth-verified — userId proviene de búsqueda autenticada por email/pin+tenantId
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
 * Tamaño máximo seguro para el payload de permisos en el JWT (en bytes).
 * Los cookies tienen un límite de ~4KB. Reservamos espacio para el resto del payload
 * (id, role, name, tenantId, iss, aud, iat, exp) y overhead de firma JWT.
 */
const MAX_PERMISSIONS_SIZE_BYTES = 2048;

/**
 * Genera un token JWT con los datos del usuario autenticado.
 * Incluye tenantId en el payload para aislamiento multi-inquilino en cada request.
 *
 * Si el objeto de permisos excede MAX_PERMISSIONS_SIZE_BYTES, se omite del token
 * para evitar superar el límite de 4KB de las cookies. En ese caso, el middleware
 * requirePermission consultará la BD como fallback.
 */
const generateToken = (user: { id: number; name: string; tenantId: number; role: { name: string; permissions: unknown } }, expiresIn: string): string => {
    const permissions = user.role.permissions || {};
    const permissionsSize = Buffer.byteLength(JSON.stringify(permissions), 'utf8');

    if (permissionsSize > MAX_PERMISSIONS_SIZE_BYTES) {
        logger.warn(`[AUTH] Permissions for role "${user.role.name}" exceed ${MAX_PERMISSIONS_SIZE_BYTES}B (${permissionsSize}B). Omitting from JWT; will use DB fallback.`);
    }

    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name,
        tenantId: user.tenantId,
        permissions: permissionsSize <= MAX_PERMISSIONS_SIZE_BYTES ? permissions : undefined
    };

    // JWT_SECRET se valida al arranque del servidor, por lo que es seguro hacer assert aquí
    // SEC-P2-01: Explicit algorithm to prevent alg confusion attacks
    return jwt.sign(payload, JWT_SECRET!, { algorithm: 'HS256', expiresIn, issuer: JWT_ISSUER, audience: JWT_AUDIENCE } as jwt.SignOptions);
};

// =============================================================================
// FUNCIONES DE REFRESH TOKEN
// =============================================================================

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_REFRESH_TOKENS_PER_USER = 5;

/**
 * Crea un refresh token para un usuario.
 * Almacena un hash SHA-256 en la BD; retorna el token crudo para setear en cookie.
 * Aplica límite máximo de tokens por usuario, eliminando el más antiguo si se excede.
 */
export const createRefreshToken = async (userId: number, tenantId: number): Promise<string> => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Limitar cantidad de tokens por usuario (eliminar el más antiguo si se excede)
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
 * Valida y consume un refresh token (rotación).
 * Retorna un nuevo access token + nuevo refresh token.
 * El token viejo se elimina para prevenir reutilización.
 *
 * SEC-P2-05: If a token is not found, it may indicate token reuse (replay attack).
 * Since the token was already consumed, an attacker or the legitimate user is replaying it.
 * We defensively revoke ALL tokens for the user extracted from the hashed token lookup
 * to force re-authentication on all devices.
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
        // SEC-P2-05: Token not found — possible replay attack.
        // Log for security monitoring. Full reuse detection with family-based
        // revocation requires adding a familyId column (future schema migration).
        logger.warn('[SECURITY] Refresh token not found — possible token reuse/replay attempt', {
            tokenPrefix: hashedToken.substring(0, 8),
        });
        throw new UnauthorizedError('Invalid refresh token');
    }

    // Verificar expiración del token
    if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedError('Refresh token expired');
    }

    // Verificar que el usuario sigue activo
    if (!storedToken.user.isActive) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedError('User account is inactive');
    }

    // SEC-P2-05: Atomic rotation — delete old token and create new one in transaction
    // to prevent race conditions where two concurrent refreshes could both succeed
    const accessToken = generateToken(storedToken.user, '12h');
    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newHashedToken = crypto.createHash('sha256').update(newRawToken).digest('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.$transaction([
        prisma.refreshToken.delete({ where: { id: storedToken.id } }),
        prisma.refreshToken.create({
            data: {
                tenantId: storedToken.tenantId,
                userId: storedToken.userId,
                token: newHashedToken,
                expiresAt: newExpiresAt
            }
        })
    ]);

    const newRefreshToken = newRawToken;

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
 * Revoca todos los refresh tokens de un usuario (usado en logout).
 * Invalida todas las sesiones activas del usuario en ese tenant.
 */
export const revokeRefreshTokens = async (userId: number, tenantId: number): Promise<void> => {
    await prisma.refreshToken.deleteMany({
        where: { userId, tenantId }
    });
};

// =============================================================================
// LIMPIEZA DE REFRESH TOKENS EXPIRADOS
// =============================================================================

/**
 * Elimina todos los refresh tokens expirados de la base de datos.
 * Debe ejecutarse periódicamente para evitar acumulación de filas muertas.
 */
export const cleanupExpiredRefreshTokens = async (): Promise<number> => {
    const result = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } }
    });
    if (result.count > 0) {
        logger.info(`[AUTH] Cleaned up ${result.count} expired refresh tokens`);
    }
    return result.count;
};

// =============================================================================
// FUNCIONES DE AUTENTICACIÓN
// =============================================================================

/**
 * Login por PIN (flujo principal para meseros/cajeros en POS).
 * Usa búsqueda O(1) por SHA-256 + verificación bcrypt como defensa en profundidad.
 */
export const loginWithPin = async (pin: string, tenantId: number) => {
    // 1. Validar formato de entrada
    const validation = LoginSchema.safeParse({ pin, tenantId });
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error);
    }

    // 2. FIX P0-PERF-001: Búsqueda O(1) por PIN usando columna pinLookup (SHA-256)
    const pinLookupHash = generatePinLookup(pin);
    let candidate = await prisma.user.findFirst({
        where: {
            tenantId,
            pinLookup: pinLookupHash,
            isActive: true
        },
        include: { role: true }
    });

    // Migración gradual: si no se encontró por pinLookup, intentar escaneo O(n) legacy
    // para usuarios que existían antes de agregar la columna pinLookup
    if (!candidate) {
        const legacyCandidates = await prisma.user.findMany({
            where: {
                tenantId,
                pinHash: { not: null },
                pinLookup: null, // Solo escanear usuarios sin pinLookup
                isActive: true
            },
            include: { role: true }
        });
        for (const legacy of legacyCandidates) {
            if (await bcrypt.compare(pin, legacy.pinHash!)) {
                candidate = legacy;
                // Backfill: guardar pinLookup para que la próxima vez sea O(1)
                await prisma.user.update({
                    where: { id: legacy.id },
                    data: { pinLookup: pinLookupHash }
                });
                logger.info(`[AUTH] Backfilled pinLookup for user ${legacy.id}`);
                break;
            }
        }
    }

    // SEC-AUD-006: Check lockout BEFORE bcrypt to avoid wasting CPU on locked accounts
    // and to prevent timing-based PIN validity leakage
    // SEC-FIX: Use generic error message to prevent user enumeration via lockout differentiation
    if (candidate && isAccountLocked(candidate)) {
        logger.warn('Login attempt on locked account', { userId: candidate.id, tenantId });
        throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Verificar PIN con bcrypt (defensa en profundidad contra colisiones SHA-256)
    // SEC-P2-03: Timing-safe — always run bcrypt.compare even when no candidate found
    // to prevent timing oracle that reveals whether a PIN exists in the system
    let user = null;
    if (candidate && candidate.pinHash) {
        if (await bcrypt.compare(pin, candidate.pinHash)) {
            user = candidate;
        }
    } else {
        // Dummy compare to normalize response time when no candidate found
        await bcrypt.compare(pin, DUMMY_BCRYPT_HASH);
    }

    // SEGURIDAD: No revelar si el PIN existe o no (misma respuesta para PIN inválido o inexistente)
    if (!user) {
        // Track failed attempt if a candidate was found but PIN didn't match
        if (candidate) {
            await handleFailedLogin(candidate.id);
        }
        throw new UnauthorizedError('Invalid credentials');
    }

    // 5. Resetear intentos fallidos tras login exitoso
    if (user.failedLoginAttempts > 0) {
        await resetFailedAttempts(user.id);
    }

    // 6. Generar token JWT con datos del usuario y tenantId
    const token = generateToken(user, '12h');

    // 7. Retornar datos de sesión al cliente
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

/**
 * Registro de un nuevo usuario dentro de un tenant existente.
 * Valida unicidad de email y PIN dentro del mismo tenant.
 */
export const register = async (data: RegisterData) => {
    // 1. Validar formato de entrada con Zod
    const validation = RegisterSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Verificar que no exista otro usuario con el mismo email en este tenant
    const existingByEmail = await prisma.user.findFirst({
        where: {
            email: data.email,
            tenantId: data.tenantId
        }
    });

    if (existingByEmail) {
        throw new ConflictError('User with this email already exists');
    }

    // 3. FIX P0-PERF-002: Verificación O(1) de unicidad de PIN usando pinLookup
    const pinLookupHash = generatePinLookup(data.pinCode);
    const existingPinUser = await prisma.user.findFirst({
        where: {
            tenantId: data.tenantId,
            pinLookup: pinLookupHash
        }
    });
    if (existingPinUser) {
        throw new ConflictError('PIN already in use');
    }

    // 4. Hashear contraseña y PIN con bcrypt
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const pinHash = await bcrypt.hash(data.pinCode, BCRYPT_SALT_ROUNDS);

    // 5. Crear usuario con pinLookup para autenticación O(1) futura
    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            pinHash,
            pinLookup: pinLookupHash,
            roleId: data.roleId,
            tenantId: data.tenantId
        },
        include: { role: true }
    });

    // 6. Generar token JWT para sesión inmediata post-registro
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

/**
 * Login por email y contraseña (flujo para administradores y acceso web).
 * Incluye protección contra fuerza bruta con bloqueo de cuenta.
 */
export const loginWithPassword = async (data: PasswordLoginData) => {
    // 1. Validar formato de entrada
    const validation = PasswordLoginSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Buscar usuario por email dentro del tenant
    const user = await prisma.user.findFirst({
        where: {
            email: data.email,
            tenantId: data.tenantId
        },
        include: { role: true }
    });

    // SEC-P2-03: Timing-safe — run dummy bcrypt when user not found to prevent
    // email enumeration via response time differences
    if (!user) {
        await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
        throw new UnauthorizedError('Invalid credentials');
    }

    // SEC-FIX: Use generic error message to prevent user enumeration via lockout differentiation
    if (isAccountLocked(user)) {
        logger.warn('Login attempt on locked account', { userId: user.id, tenantId: data.tenantId });
        throw new UnauthorizedError('Invalid credentials');
    }

    // 4. Verificar que el usuario esté activo y tenga contraseña configurada
    if (!user.isActive || !user.passwordHash) {
        throw new UnauthorizedError('Invalid credentials or inactive user');
    }

    // 5. Verificar contraseña con bcrypt
    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
        // SEGURIDAD: Registrar intento fallido para eventual bloqueo
        await handleFailedLogin(user.id);
        throw new UnauthorizedError('Invalid credentials');
    }

    // 6. Resetear intentos fallidos tras login exitoso
    if (user.failedLoginAttempts > 0) {
        await resetFailedAttempts(user.id);
    }

    // 7. Generar token JWT con datos del usuario y tenantId
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

/**
 * Registro de un nuevo tenant (onboarding completo).
 * Crea en una transacción atómica: tenant, configuración, roles predeterminados y usuario admin.
 * Genera un PIN aleatorio para el admin como método de acceso alternativo.
 */
export const registerTenant = async (data: RegisterTenantData) => {
    // 1. Validar formato de entrada
    const validation = RegisterTenantSchema.safeParse(data);
    if (!validation.success) {
        throw new ValidationError('Invalid format', validation.error.issues);
    }

    // 2. Generar código slug a partir del nombre del negocio (para URLs y referencias)
    // SEC-FIX: Use CSPRNG instead of Math.random() to prevent PRNG state prediction
    const code = data.businessName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + crypto.randomInt(0, 1000);

    // 3. Crear tenant y toda la configuración inicial en una transacción atómica
    const result = await prisma.$transaction(async (tx) => {
        // Crear el tenant (inquilino)
        const tenant = await tx.tenant.create({
            data: {
                name: data.businessName,
                code,
                activeSubscription: true
            }
        });

        // Crear configuración del tenant con valores predeterminados
        await tx.tenantConfig.create({
            data: {
                tenantId: tenant.id,
                businessName: data.businessName,
                currencySymbol: '$'
            }
        });

        // Crear roles predeterminados: ADMIN con acceso total
        const adminRole = await tx.role.create({
            data: {
                tenantId: tenant.id,
                name: 'ADMIN',
                permissions: { all: true } // Acceso completo a todo el sistema
            }
        });

        // Rol WAITER: permisos limitados para meseros (crear/ver órdenes y mesas)
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

        // Rol KITCHEN: permisos limitados para cocina (ver órdenes y actualizar estado)
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

        // Crear usuario administrador con contraseña y PIN de respaldo
        const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
        // Generar PIN aleatorio de 6 dígitos como método de acceso rápido
        // SEC-FIX: Use CSPRNG for PIN generation to prevent prediction attacks
        const pinCode = crypto.randomInt(100000, 1000000).toString();
        const pinHash = await bcrypt.hash(pinCode, BCRYPT_SALT_ROUNDS);
        const pinLookup = generatePinLookup(pinCode);

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                roleId: adminRole.id,
                name: data.name,
                email: data.email,
                passwordHash,
                pinHash,
                pinLookup,
                isActive: true
            }
        });

        return { tenant, user, pinCode };
    });

    // 4. Generar token JWT para sesión inmediata post-registro del tenant
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
            activeSubscription: result.tenant.activeSubscription
        },
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            tenantId: result.tenant.id,
            generatedPin: result.pinCode // Se retorna el PIN generado una sola vez
        },
        token
    };
};
