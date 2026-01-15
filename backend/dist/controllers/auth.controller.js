"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.registerUser = exports.loginPin = void 0;
const auth_service_1 = require("../services/auth.service");
const response_1 = require("../utils/response");
const loginPin = async (req, res, next) => {
    try {
        const { pin } = req.body;
        if (!pin) {
            return (0, response_1.sendError)(res, 'MISSING_PIN', 'PIN is required');
        }
        const result = await (0, auth_service_1.loginWithPin)(pin);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        if (error.code) {
            return (0, response_1.sendError)(res, error.code, error.message, error.details || null, 401);
        }
        next(error);
    }
};
exports.loginPin = loginPin;
const registerUser = async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.register)(req.body);
        return (0, response_1.sendSuccess)(res, result, undefined, 201);
    }
    catch (error) {
        if (error.code) {
            const status = error.code === 'VALIDATION_ERROR' ? 400 : error.code === 'USER_EXISTS' ? 409 : 500;
            return (0, response_1.sendError)(res, error.code, error.message, error.details || null, status);
        }
        next(error);
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.loginWithPassword)(req.body);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        if (error.code) {
            return (0, response_1.sendError)(res, error.code, error.message, error.details || null, 401);
        }
        next(error);
    }
};
exports.loginUser = loginUser;
//# sourceMappingURL=auth.controller.js.map