"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_1 = require("../utils/response");
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return (0, response_1.sendError)(res, 'AUTH_REQUIRED', 'No token provided', null, 401);
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_key', (err, decoded) => {
        if (err) {
            return (0, response_1.sendError)(res, 'AUTH_INVALID', 'Invalid token', null, 403);
        }
        req.user = decoded;
        next();
    });
};
exports.authenticateToken = authenticateToken;
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
//# sourceMappingURL=auth.js.map