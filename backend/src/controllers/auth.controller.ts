/**
 * @fileoverview Controlador de Autenticación
 *
 * Gestiona la autenticación de usuarios mediante PIN numérico (para mozos/cajeros)
 * y contraseña (para administradores). También maneja el registro de nuevos usuarios
 * y tenants, el cierre de sesión, y la renovación de tokens.
 *
 * Cumple OWASP ASVS 4.0 para gestión de sesiones: los tokens JWT se almacenan
 * en cookies HttpOnly para prevenir robo por XSS (fix P0-004).
 *
 * @module controllers/auth.controller
 */

import { Request, Response } from 'express';
import { AuditAction } from '@prisma/client';
import { loginWithPin, register, loginWithPassword, registerTenant, createRefreshToken, refreshAccessToken, revokeRefreshTokens } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService, getAuditContext } from '../services/audit.service';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURACION DE COOKIES (según TDD Sección 3.3)
// ============================================================================

/**
 * Opciones de cookie para almacenar el JWT de acceso.
 * Cada opción corresponde a un requisito OWASP ASVS 4.0:
 * - httpOnly: V3.4.1 — previene acceso desde JavaScript (protección XSS)
 * - secure: V3.4.2 — solo HTTPS en producción
 * - sameSite strict: V3.4.3 — previene CSRF
 * - path /api: limita el envío de la cookie solo a rutas de la API
 * - maxAge 12h: alineado con la expiración del JWT
 */
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,           // V3.4.1: Prevenir acceso desde JavaScript (protección XSS)
  secure: process.env.NODE_ENV === 'production', // V3.4.2: Solo HTTPS en producción
  sameSite: 'strict' as const, // V3.4.3: Prevenir CSRF
  path: '/api',             // Limitar a rutas de la API
  maxAge: 12 * 60 * 60 * 1000, // 12 horas — alineado con expiresIn del JWT
};

const AUTH_COOKIE_NAME = 'auth_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Opciones de cookie para el refresh token.
 * El path se restringe al endpoint de refresh para evitar envíos innecesarios.
 * Duración de 7 días para permitir sesiones prolongadas sin re-login.
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh', // Solo se envía al endpoint de refresh
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

// CQ-003: getAuditContext se importa desde audit.service

/**
 * Establece la cookie de autenticación en la respuesta HTTP.
 * El token JWT queda inaccesible para JavaScript del navegador (HttpOnly).
 */
function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  logger.debug('Auth cookie set', {
    cookieName: AUTH_COOKIE_NAME,
    httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
    secure: AUTH_COOKIE_OPTIONS.secure,
    sameSite: AUTH_COOKIE_OPTIONS.sameSite,
  });
}

/**
 * Establece la cookie del refresh token en la respuesta HTTP.
 */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, REFRESH_COOKIE_OPTIONS);
}

/**
 * Limpia las cookies de autenticación y refresh al cerrar sesión.
 * Se deben especificar las mismas opciones de path/domain para que el navegador las elimine.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
  });
}

// ============================================================================
// CONTROLADORES DE AUTENTICACION
// ============================================================================

/**
 * Login por PIN numérico (6 dígitos).
 * Usado por mozos y cajeros que necesitan un acceso rápido desde el POS.
 * El token se devuelve SOLO en cookie HttpOnly, nunca en el cuerpo de la respuesta.
 */
export const loginPin = asyncHandler(async (req: Request, res: Response) => {
    const { pin, tenantId: rawTenantId } = req.body;

    if (!rawTenantId) {
        return sendError(res, 'MISSING_TENANT', 'El ID del tenant es requerido');
    }

    if (!pin) {
        return sendError(res, 'MISSING_CREDENTIALS', 'El PIN es requerido');
    }

    // Verificar que el tenant exista y tenga suscripción activa antes de autenticar
    const tenant = await prisma.tenant.findFirst({
        where: { id: rawTenantId, activeSubscription: true }
    });
    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Organización inválida o inactiva');
    }
    const tenantId = tenant.id;

    try {
        const result = await loginWithPin(pin, tenantId);

        // FIX P0-004: Token en cookie HttpOnly en vez del cuerpo de respuesta
        setAuthCookie(res, result.token);

        // Establecer cookie del refresh token para renovación automática
        const refreshToken = await createRefreshToken(result.user.id, tenantId);
        setRefreshCookie(res, refreshToken);

        // Auditoría: registrar login exitoso por PIN
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PIN',
            role: result.user.role,
            tenantId,
            authMethod: 'COOKIE'
        });

        // Devolver datos del usuario SIN token (el token viaja en la cookie)
        return sendSuccess(res, {
          user: result.user,
          message: 'Autenticación exitosa'
        });
    } catch (error) {
        // Auditoría: registrar intento de login fallido para detección de fuerza bruta
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PIN',
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});

/**
 * Registro de un nuevo usuario dentro de un tenant existente.
 * Valida que el tenant exista y esté activo antes de permitir el registro (P1-26).
 */
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
    // P1-26: Validar que el tenant exista y esté activo antes de registrar
    const { tenantId: rawTenantId } = req.body;
    if (!rawTenantId) {
        return sendError(res, 'MISSING_TENANT', 'El ID del tenant es requerido');
    }
    const tenant = await prisma.tenant.findFirst({
        where: { id: rawTenantId, activeSubscription: true }
    });
    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Organización inválida o inactiva');
    }

    const result = await register(req.body);

    // FIX P0-004: Token en cookie HttpOnly
    setAuthCookie(res, result.token);

    // Auditoría: el registro es un evento de seguridad significativo
    await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
        method: 'REGISTER',
        role: result.user.role,
        tenantId: req.body.tenantId,
        authMethod: 'COOKIE'
    });

    // Devolver datos del usuario SIN token
    return sendSuccess(res, {
      user: result.user,
      message: 'Registro exitoso'
    }, undefined, 201);
});

/**
 * Registro de un nuevo tenant (onboarding SaaS).
 * Crea la organización, el usuario admin inicial y genera el token de acceso.
 */
export const registerNewTenant = asyncHandler(async (req: Request, res: Response) => {
    const result = await registerTenant(req.body);

    // Establecer token en cookie para el admin recién creado
    setAuthCookie(res, result.token);

    // Auditoría: registrar la creación del nuevo tenant
    await auditService.log(
        AuditAction.CONFIG_CHANGED, // Registro de tenant (no hay enum dedicado)
        'Tenant',
        result.tenant.id,
        {
            userId: result.user.id,
            tenantId: result.tenant.id,
            ipAddress: String(req.ip || 'unknown'),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { businessName: result.tenant.name, email: result.user.email }
    );

    return sendSuccess(res, {
        tenant: result.tenant,
        user: result.user,
        message: 'Tenant registrado exitosamente'
    }, undefined, 201);
});

/**
 * Login por email y contraseña.
 * Usado por administradores y roles que requieren credenciales más seguras.
 * Si se proporciona tenantId, valida suscripción activa (BIZ-006).
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    // BIZ-006: Validar suscripción del tenant antes del login por contraseña (igual que en PIN)
    const { tenantId: rawTenantId } = req.body;
    if (rawTenantId) {
        const tenant = await prisma.tenant.findFirst({
            where: { id: rawTenantId, activeSubscription: true }
        });
        if (!tenant) {
            return sendError(res, 'INVALID_TENANT', 'Organización inválida o inactiva');
        }
    }

    try {
        const result = await loginWithPassword(req.body);

        // FIX P0-004: Token en cookie HttpOnly
        setAuthCookie(res, result.token);

        // Establecer cookie del refresh token
        const refreshToken = await createRefreshToken(result.user.id, result.user.tenantId);
        setRefreshCookie(res, refreshToken);

        // Auditoría: registrar login exitoso por contraseña
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            role: result.user.role,
            tenantId: req.body.tenantId,
            authMethod: 'COOKIE'
        });

        // Devolver datos del usuario SIN token
        return sendSuccess(res, {
          user: result.user,
          message: 'Autenticación exitosa'
        });
    } catch (error) {
        // Auditoría: registrar intento fallido para monitoreo de seguridad
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});

/**
 * Resuelve un tenant por su código de negocio.
 * Endpoint público usado por la página de login para determinar el tenantId
 * a partir del código o nombre del negocio ingresado por el usuario.
 */
export const resolveTenant = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    if (!code || typeof code !== 'string') {
        return sendError(res, 'MISSING_CODE', 'El código de negocio es requerido');
    }

    const tenant = await prisma.tenant.findFirst({
        where: {
            activeSubscription: true,
            OR: [
                { code },
                { name: { equals: code } }
            ]
        },
        select: { id: true, name: true }
    });

    if (!tenant) {
        return sendError(res, 'INVALID_TENANT', 'Negocio no encontrado o inactivo', null, 404);
    }

    return sendSuccess(res, { tenantId: tenant.id, name: tenant.name });
});

/**
 * Cierre de sesión. Limpia cookies de auth y refresh, y revoca todos los refresh tokens
 * del usuario en la base de datos para invalidar sesiones en otros dispositivos.
 */
export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    // Limpiar cookies de autenticación y refresh
    clearAuthCookie(res);

    // Revocar todos los refresh tokens del usuario en BD
    if (req.user) {
        await revokeRefreshTokens(req.user.id, req.user.tenantId);
        await auditService.logAuth('LOGOUT', req.user.id, getAuditContext(req), {
            authMethod: 'COOKIE'
        });
    }

    return sendSuccess(res, { message: 'Sesión cerrada exitosamente' });
});

/**
 * Renovación de token de acceso usando el refresh token.
 * Lee el refresh_token de la cookie HttpOnly, lo valida, genera un nuevo access token
 * y rota el refresh token (el anterior queda invalidado).
 */
export const refreshTokenHandler = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
        return sendError(res, 'NO_REFRESH_TOKEN', 'Token de actualización no proporcionado', null, 401);
    }

    const result = await refreshAccessToken(rawToken);

    // Establecer nuevo access token en cookie
    setAuthCookie(res, result.accessToken);

    // Establecer refresh token rotado (el anterior se invalida)
    setRefreshCookie(res, result.refreshToken);

    return sendSuccess(res, {
        user: result.user,
        message: 'Token renovado exitosamente'
    });
});
