"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.authorize = exports.authenticate = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_1 = require("../utils/response");
// Get JWT_SECRET - will throw at import time if missing (from auth.service.ts)
const JWT_SECRET = process.env.JWT_SECRET;
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return (0, response_1.sendError)(res, 'AUTH_REQUIRED', 'No token provided', null, 401);
    }
    if (!JWT_SECRET) {
        return (0, response_1.sendError)(res, 'CONFIG_ERROR', 'Server configuration error', null, 500);
    }
    // FIX P1-003: Explicit algorithm to prevent "alg: none" attack
    jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            return (0, response_1.sendError)(res, 'AUTH_INVALID', 'Invalid token', null, 403);
        }
        req.user = decoded;
        next();
    });
};
exports.authenticateToken = authenticateToken;
exports.authenticate = exports.authenticateToken;
const authorize = (allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }
        // We need to fetch the user's role name if it's not in the token.
        // If token only has { id, role: 'ADMIN' }, we are good.
        // Let's assume token has role name for performance, or we check DB.
        // Checking token first.
        const userRole = req.user.role;
        if (!userRole) {
            // Fallback: Check DB if role not in token? 
            // For now, assume token has role. Login service should ensure it.
            return (0, response_1.sendError)(res, 'AUTH_INVALID', 'User has no role assigned', null, 403);
        }
        if (!allowedRoles.includes(userRole)) {
            return (0, response_1.sendError)(res, 'AUTH_FORBIDDEN', `Role ${userRole} is not authorized`, null, 403);
        }
        next();
    };
};
exports.authorize = authorize;
/**
 * Middleware to enforce granular permissions based on RBAC.
 * Verifies if the authenticated user has the specific action allowed on the resource.
 *
 * @business_rule
 * - ADMIN role has full access to all resources and actions (bypass)
 * - Other roles require explicit permissions in the token/user object
 *
 * @param resource - The resource identifier (e.g. 'orders', 'products')
 * @param action - The action attempted (e.g. 'create', 'delete')
 */
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'AUTH_REQUIRED', 'Not authenticated', null, 401);
        }
        // ADMIN BYPASS: Admin role has full access to everything
        if (req.user.role === 'ADMIN') {
            return next();
        }
        const permissions = req.user.permissions;
        // If no permissions found in token/user object, deny access
        if (!permissions) {
            return (0, response_1.sendError)(res, 'AUTH_INVALID', 'User has no permissions assigned', null, 403);
        }
        // Check if resource exists in permissions
        const resourcePermissions = permissions[resource];
        if (!resourcePermissions || !Array.isArray(resourcePermissions)) {
            return (0, response_1.sendError)(res, 'AUTH_FORBIDDEN', `Access to resource '${resource}' denied`, null, 403);
        }
        if (!resourcePermissions.includes(action) && !resourcePermissions.includes('*')) {
            return (0, response_1.sendError)(res, 'AUTH_FORBIDDEN', `Action '${action}' on '${resource}' denied`, null, 403);
        }
        next();
    };
};
exports.requirePermission = requirePermission;
//# sourceMappingURL=auth.js.map