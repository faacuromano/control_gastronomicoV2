import { JsonValue } from '@prisma/client/runtime/library';

/**
 * JWT Payload structure as returned by auth service
 */
export interface JwtPayload {
    id: number;
    role: string;
    name: string;
    iat?: number;  // Issued at (added by JWT)
    exp?: number;  // Expiration (added by JWT)
}

/**
 * Extended user info for request context
 */
export interface AuthenticatedUser extends JwtPayload {
    permissions?: JsonValue;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

export {};

