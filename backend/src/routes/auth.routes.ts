/**
 * @fileoverview Rutas de Autenticación y Registro
 *
 * Maneja todos los flujos de acceso al sistema: login por PIN (operación rápida
 * en POS), login por email/contraseña (acceso administrativo), registro de
 * usuarios dentro de un tenant existente, y signup de nuevos tenants (SaaS).
 *
 * Todas las rutas de login están protegidas con rate limiting para prevenir
 * ataques de fuerza bruta. El token JWT se almacena en una cookie HttpOnly
 * (no en localStorage) para mayor seguridad contra XSS.
 *
 * @module routes/auth.routes
 */

import { Router } from 'express';
import express from 'express';
import { loginPin, loginUser, registerUser, logoutUser, registerNewTenant, resolveTenant, refreshTokenHandler } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// SEC-P4-02: Stricter body size limit for auth endpoints.
// Auth payloads are small (PIN=6 chars, email+password ~200 chars).
// A 16KB limit prevents abuse while accommodating all valid auth requests.
const authBodyLimit = express.json({ limit: '16kb' });

// Público: Resolver tenant por código de negocio (usado en la página de login para
// identificar a qué empresa pertenece el usuario antes de autenticarse)
router.get('/tenant/:code', authRateLimiter, resolveTenant);

// Endpoints de login protegidos con rate limiting para evitar ataques de fuerza bruta.
// Login por PIN: flujo rápido para meseros y cajeros en el punto de venta
router.post('/login/pin', authBodyLimit, authRateLimiter, loginPin);
// Login por email/contraseña: flujo estándar para administradores y managers
router.post('/login', authBodyLimit, authRateLimiter, loginUser);
// SEC-AUD-002: Registro de nuevo usuario — requiere autenticación y permiso users:create
// para evitar escalación de privilegios (cualquier usuario podría crear un admin sin esto)
router.post('/register', authBodyLimit, authRateLimiter, authenticateToken, requirePermission('users', 'create'), registerUser);
// Registro público SaaS: crea un nuevo tenant con su usuario administrador inicial
router.post('/signup', authBodyLimit, authRateLimiter, registerNewTenant);

// Renovación de token usando la cookie refresh_token (no requiere auth_token vigente)
router.post('/refresh', authRateLimiter, refreshTokenHandler);

// Logout does NOT require auth — must succeed even with expired/missing token
// to avoid 401 loop on the frontend. User info is extracted best-effort for audit/revocation.
router.post('/logout', logoutUser);

export default router;
