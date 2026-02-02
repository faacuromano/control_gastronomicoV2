/**
 * @fileoverview Augmentacion del tipo Request de Express para autenticacion.
 *
 * Este archivo extiende la interfaz Request de Express para incluir la propiedad
 * 'user' con tipo fuerte. El middleware authenticateToken (middleware/auth.ts)
 * verifica el JWT y establece req.user con los datos decodificados del token.
 *
 * Gracias a esta augmentacion, todos los controladores pueden acceder a
 * req.user!.tenantId, req.user!.id, req.user!.permissions, etc.
 * con autocompletado y verificacion de tipos en tiempo de compilacion.
 *
 * @module types/express-extensions
 */

/**
 * Estructura de permisos para el sistema RBAC (Control de Acceso Basado en Roles).
 * Mapea nombres de recursos a un array de acciones permitidas.
 * El wildcard '*' en acciones indica acceso total al recurso.
 *
 * @example
 * {
 *   "orders": ["create", "read", "update"],   // Acceso parcial a ordenes
 *   "products": ["*"],                         // Acceso total a productos
 *   "users": ["read"]                          // Solo lectura de usuarios
 * }
 */
export type Permissions = Record<string, string[]>;

/**
 * Estructura del payload JWT tal como se codifica/decodifica en el servicio de auth.
 * Este es el contenido minimo almacenado dentro del token JWT.
 *
 * IMPORTANTE: tenantId es requerido (no opcional) porque cada request autenticado
 * DEBE estar asociado a un tenant especifico en el sistema multi-tenant.
 * Sin tenantId, las queries de Prisma no podrian filtrar por tenant y se
 * producirian fugas de datos entre tenants.
 */
export interface JwtPayload {
    /** ID del usuario en la base de datos */
    id: number;
    /** Nombre del rol (ej: 'ADMIN', 'WAITER', 'MANAGER') */
    role: string;
    /** Nombre visible del usuario (para mostrar en la UI) */
    name: string;
    /** Mapa de permisos RBAC, opcional porque algunos flujos no lo requieren */
    permissions?: Permissions;
    /** ID del tenant para aislamiento multi-tenant. Requerido en todo request autenticado. */
    tenantId: number;
    /** Timestamp de emision del JWT (generado automaticamente por jsonwebtoken) */
    iat?: number;
    /** Timestamp de expiracion del JWT (generado automaticamente por jsonwebtoken) */
    exp?: number;
}

/**
 * Informacion extendida del usuario adjunta al Request despues de autenticacion.
 * Actualmente identica a JwtPayload, pero permite extension futura con datos
 * obtenidos de la base de datos (no solo del token), como configuracion del tenant,
 * foto de perfil, o estado de suscripcion.
 */
export interface AuthenticatedUser extends JwtPayload {}

/**
 * Augmentacion global de la interfaz Request de Express.
 * Esto permite que req.user tenga tipo fuerte en toda la aplicacion
 * sin necesidad de casteos manuales en cada controlador.
 */
declare global {
    namespace Express {
        interface Request {
            /**
             * Datos del usuario autenticado, poblados por el middleware authenticateToken.
             * Sera undefined si el request no paso por autenticacion (rutas publicas).
             */
            user?: AuthenticatedUser;

            /**
             * Body JSON parseado desde el middleware de validacion HMAC de webhooks.
             * Se establece despues de validar la firma del webhook en hmac.middleware.ts.
             * Solo presente en rutas de webhooks de plataformas de delivery.
             */
            parsedBody?: unknown;
        }
    }
}

// Necesario para que TypeScript trate este archivo como un modulo
// y la augmentacion global funcione correctamente
export {};
