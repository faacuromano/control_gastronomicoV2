/**
 * @fileoverview Middleware de Autenticacion y Autorizacion
 *
 * Gestiona la validacion de tokens JWT y la autorizacion basada en roles (RBAC).
 * Este middleware es el punto central de seguridad de la aplicacion: verifica
 * la identidad del usuario y controla el acceso a los recursos protegidos.
 *
 * @complexity O(1) para la verificacion del token
 * @guarantee Cumple con OWASP ASVS 4.0
 * @implements TDD Seccion 3.2 - Flujo de solicitudes API
 *
 * FIX P0-004: Ahora lee el JWT desde una cookie HttpOnly (fuente principal)
 * con respaldo al header Authorization para llamadas API key / servicio-a-servicio.
 *
 * @module middleware/auth
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import type { JwtPayload, Permissions } from '../types/express-extensions';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURACION
// ============================================================================

/**
 * Secreto JWT obtenido de las variables de entorno.
 * Si no esta definido, auth.service.ts lanzara un error al momento de importar.
 */
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Nombre de la cookie de autenticacion (debe coincidir con auth.controller.ts).
 * Se usa una cookie HttpOnly para resistir ataques XSS.
 */
const AUTH_COOKIE_NAME = 'auth_token';

// ============================================================================
// EXTRACCION DEL TOKEN
// ============================================================================

/**
 * Extrae el token JWT de la solicitud HTTP.
 *
 * Prioridad de busqueda:
 * 1. Cookie HttpOnly (recomendado, resistente a XSS)
 * 2. Header Authorization Bearer (para API keys / comunicacion servicio-a-servicio)
 *
 * Se prioriza la cookie porque el frontend envia credenciales via cookies,
 * mientras que el header se mantiene como respaldo para integraciones externas.
 *
 * @implements TDD Seccion 3.2 - API Request -> Flujo de Auth via Cookie
 *
 * @param req - Objeto de solicitud de Express
 * @returns Token JWT como string o null si no se encontro
 */
function extractToken(req: Request): string | null {
  // Prioridad 1: Cookie HttpOnly (FIX P0-004)
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  // Prioridad 2: Header Authorization (compatibilidad retroactiva / API keys)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.split(' ')[1];
    return headerToken ?? null;
  }

  return null;
}

// ============================================================================
// MIDDLEWARE DE AUTENTICACION
// ============================================================================

/**
 * Autentica solicitudes usando un token JWT.
 *
 * Flujo:
 * 1. Extrae el token de la cookie o del header Authorization
 * 2. Verifica la firma del token con el secreto JWT
 * 3. Decodifica el payload y lo asigna a req.user para uso posterior
 *
 * Si el token es invalido o no esta presente, rechaza la solicitud inmediatamente.
 *
 * @complexity O(1) - La verificacion JWT es de tiempo constante
 * @guarantee Token extraido desde cookie HttpOnly (resistente a XSS)
 * @implements TDD Seccion 3.2 - Validacion en Middleware
 *
 * FIX P0-004: La fuente principal del token ahora es req.cookies[auth_token]
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
        logger.debug('Auth failed: no token found', {
            hasCookie: !!req.cookies?.[AUTH_COOKIE_NAME],
            hasAuthHeader: !!req.headers['authorization'],
            path: req.path,
        });
        return sendError(res, 'AUTH_REQUIRED', 'No token provided', null, 401);
    }

    if (!JWT_SECRET) {
        logger.error('JWT_SECRET not configured');
        return sendError(res, 'CONFIG_ERROR', 'Server configuration error', null, 500);
    }

    // FIX P1-003: Algoritmo explicito para prevenir el ataque "alg: none"
    // donde un atacante envia un token sin firma y el servidor lo acepta
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            logger.debug('Auth failed: invalid token', {
                error: err.message,
                path: req.path,
            });
            return sendError(res, 'AUTH_INVALID', 'Invalid token', null, 403);
        }

        req.user = decoded as JwtPayload;
        return next();
    });
};

export const authenticate = authenticateToken;

// ============================================================================
// MIDDLEWARE DE AUTORIZACION
// ============================================================================

/**
 * Autoriza solicitudes basandose en el rol del usuario.
 *
 * Este middleware se usa despues de authenticateToken para verificar
 * que el usuario tenga uno de los roles permitidos para acceder a la ruta.
 *
 * @param allowedRoles - Array con los nombres de roles que pueden acceder a la ruta
 */
export const authorize = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
             return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        const userRole = req.user.role;

        if (!userRole) {
             return sendError(res, 'AUTH_INVALID', 'User has no role assigned', null, 403);
        }

        if (!allowedRoles.includes(userRole)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Role ${userRole} is not authorized`, null, 403);
        }

        return next();
    };
};

/**
 * Middleware para aplicar permisos granulares basados en RBAC (Control de Acceso Basado en Roles).
 * Verifica si el usuario autenticado tiene la accion especifica permitida sobre el recurso solicitado.
 *
 * Cada rol tiene un mapa de permisos en formato { recurso: [acciones] }. Por ejemplo:
 * { orders: ['create', 'read'], products: ['read'] }
 *
 * @business_rule
 * - El rol ADMIN tiene acceso total a todos los recursos y acciones (bypass completo)
 * - Los demas roles requieren permisos explicitos definidos en el token/objeto de usuario
 * - El wildcard '*' en las acciones otorga acceso total al recurso
 *
 * @param resource - Identificador del recurso (ej: 'orders', 'products')
 * @param action - Accion intentada sobre el recurso (ej: 'create', 'delete')
 */
export const requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        // BYPASS ADMIN: El rol ADMIN tiene acceso total a todo el sistema
        if (req.user.role === 'ADMIN') {
            return next();
        }

        const permissions: Permissions | undefined = req.user.permissions;

        // Si no se encontraron permisos en el token/usuario, denegar acceso
        if (!permissions) {
            return sendError(res, 'AUTH_INVALID', 'User has no permissions assigned', null, 403);
        }

        // Verificar si el recurso existe en el mapa de permisos del usuario
        const resourcePermissions = permissions[resource];

        if (!resourcePermissions || !Array.isArray(resourcePermissions)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Access to resource '${resource}' denied`, null, 403);
        }

        if (!resourcePermissions.includes(action) && !resourcePermissions.includes('*')) {
             return sendError(res, 'AUTH_FORBIDDEN', `Action '${action}' on '${resource}' denied`, null, 403);
        }

        return next();
    };
};
