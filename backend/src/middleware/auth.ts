import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import { JwtPayload } from '../types/express.d';

// Get JWT_SECRET - will throw at import time if missing (from auth.service.ts)
const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return sendError(res, 'AUTH_REQUIRED', 'No token provided', null, 401);
    }

    if (!JWT_SECRET) {
        return sendError(res, 'CONFIG_ERROR', 'Server configuration error', null, 500);
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return sendError(res, 'AUTH_INVALID', 'Invalid token', null, 403);
        }
        
        req.user = decoded as JwtPayload;
        next();
    });
};

export const authenticate = authenticateToken;

export const authorize = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
             return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        // We need to fetch the user's role name if it's not in the token.
        // If token only has { id, role: 'ADMIN' }, we are good.
        // Let's assume token has role name for performance, or we check DB.
        // Checking token first.
        
        const userRole = req.user.role; 

        if (!userRole) {
            // Fallback: Check DB if role not in token? 
            // For now, assume token has role. Login service should ensure it.
             return sendError(res, 'AUTH_INVALID', 'User has no role assigned', null, 403);
        }

        if (!allowedRoles.includes(userRole)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Role ${userRole} is not authorized`, null, 403);
        }

        next();
    };
};


/**
 * Middleware to enforce granular permissions based on RBAC.
 * Verifies if the authenticated user has the specific action allowed on the resource.
 * 
 * @business_rule
 * Enforces strict access control by validating against the "permissions" JSON object from the database/token.
 * Does NOT rely solely on Role Name.
 * 
 * @param resource - The resource identifier (e.g. 'orders', 'products')
 * @param action - The action attempted (e.g. 'create', 'delete')
 */
export const requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }

        const permissions = req.user.permissions as Record<string, string[]>;

        // If no permissions found in token/user object, deny access
        if (!permissions) {
            return sendError(res, 'AUTH_INVALID', 'User has no permissions assigned', null, 403);
        }

        // Check if resource exists in permissions
        const resourcePermissions = permissions[resource];
        
        // ADMIN Override: If user has 'admin' or '*' permission on resource (optional, depending on policy)
        // For strict MVP, we stick to explicit action check, but assuming '*' might be used.
        // Let's implement strict check: Array must include action.
        
        if (!resourcePermissions || !Array.isArray(resourcePermissions)) {
            return sendError(res, 'AUTH_FORBIDDEN', `Access to resource '${resource}' denied`, null, 403);
        }

        if (!resourcePermissions.includes(action) && !resourcePermissions.includes('*')) {
             return sendError(res, 'AUTH_FORBIDDEN', `Action '${action}' on '${resource}' denied`, null, 403);
        }

        next();
    };
};
