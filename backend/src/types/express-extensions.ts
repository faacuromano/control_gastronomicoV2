/**
 * Express Request Type Augmentation
 * 
 * This file extends the Express Request interface to include our custom `user` property.
 * The `user` property is set by the `authenticateToken` middleware after JWT verification.
 * 
 * @module types/express
 */

/**
 * Permission structure for RBAC.
 * Maps resource names to allowed actions.
 * 
 * @example
 * {
 *   "orders": ["create", "read", "update"],
 *   "products": ["*"],
 *   "users": ["read"]
 * }
 */
export type Permissions = Record<string, string[]>;

/**
 * JWT Payload structure as encoded/decoded by auth service.
 * This is the minimal payload stored in the JWT token.
 */
export interface JwtPayload {
    /** User ID from database */
    id: number;
    /** Role name (e.g., 'ADMIN', 'WAITER', 'MANAGER') */
    role: string;
    /** User display name */
    name: string;
    /** RBAC permissions map */
    permissions?: Permissions;
    /** Tenant ID for multi-tenant support */
    tenantId?: number;
    /** JWT issued at timestamp */
    iat?: number;
    /** JWT expiration timestamp */
    exp?: number;
}

/**
 * Extended user info attached to Request after authentication.
 * Identical to JwtPayload for now, but allows future extension
 * with data fetched from DB (not just from token).
 */
export interface AuthenticatedUser extends JwtPayload {}

/**
 * Global augmentation of Express Request interface.
 * This allows `req.user` to be fully typed throughout all controllers.
 */
declare global {
    namespace Express {
        interface Request {
            /**
             * Authenticated user data, populated by `authenticateToken` middleware.
             * Will be `undefined` if request is not authenticated.
             */
            user?: AuthenticatedUser;
            
            /**
             * Parsed JSON body from webhook HMAC middleware.
             * Set after signature validation in hmac.middleware.ts.
             */
            parsedBody?: unknown;
        }
    }
}

// Required for TypeScript to treat this as a module
export {};
