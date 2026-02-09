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
import { loginPin, loginUser, registerUser, logoutUser, registerNewTenant, resolveTenant, refreshTokenHandler } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Público: Resolver tenant por código de negocio (usado en la página de login para
// identificar a qué empresa pertenece el usuario antes de autenticarse)
router.get('/tenant/:code', authRateLimiter, resolveTenant);

// Endpoints de login protegidos con rate limiting para evitar ataques de fuerza bruta.
// Login por PIN: flujo rápido para meseros y cajeros en el punto de venta
router.post('/login/pin', authRateLimiter, loginPin);
// Login por email/contraseña: flujo estándar para administradores y managers
router.post('/login', authRateLimiter, loginUser);
// SEC-AUD-002: Registro de nuevo usuario — requiere autenticación para evitar que
// un atacante registre usuarios en cualquier tenant usando tenantId del body
router.post('/register', authRateLimiter, authenticateToken, registerUser);
// Registro público SaaS: crea un nuevo tenant con su usuario administrador inicial
router.post('/signup', authRateLimiter, registerNewTenant);

// Renovación de token usando la cookie refresh_token (no requiere auth_token vigente)
router.post('/refresh', authRateLimiter, refreshTokenHandler);

// Logout does NOT require auth — must succeed even with expired/missing token
// to avoid 401 loop on the frontend. User info is extracted best-effort for audit/revocation.
router.post('/logout', logoutUser);

export default router;
