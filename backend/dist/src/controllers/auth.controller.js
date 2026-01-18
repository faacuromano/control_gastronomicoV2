"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.registerUser = exports.loginPin = void 0;
const auth_service_1 = require("../services/auth.service");
const response_1 = require("../utils/response");
const asyncHandler_1 = require("../middleware/asyncHandler");
const audit_service_1 = require("../services/audit.service");
/**
 * Extract audit context from request
 */
const getAuditContext = (req) => ({
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
});
exports.loginPin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { pin } = req.body;
    if (!pin) {
        return (0, response_1.sendError)(res, 'MISSING_PIN', 'PIN is required');
    }
    try {
        const result = await (0, auth_service_1.loginWithPin)(pin);
        // Audit: Log successful PIN login
        await audit_service_1.auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PIN',
            role: result.user.role
        });
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        // Audit: Log failed login attempt
        await audit_service_1.auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PIN',
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});
exports.registerUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, auth_service_1.register)(req.body);
    // Audit: User registration is a significant security event
    await audit_service_1.auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
        method: 'REGISTER',
        role: result.user.role
    });
    return (0, response_1.sendSuccess)(res, result, undefined, 201);
});
exports.loginUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        const result = await (0, auth_service_1.loginWithPassword)(req.body);
        // Audit: Log successful password login
        await audit_service_1.auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            role: result.user.role
        });
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        // Audit: Log failed login attempt
        await audit_service_1.auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});
//# sourceMappingURL=auth.controller.js.map