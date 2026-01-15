"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentShift = exports.closeShift = exports.openShift = void 0;
const cashShift_service_1 = require("../services/cashShift.service");
const response_1 = require("../utils/response");
const zod_1 = require("zod");
const openShiftSchema = zod_1.z.object({
    startAmount: zod_1.z.number().min(0)
});
const closeShiftSchema = zod_1.z.object({
    endAmount: zod_1.z.number().min(0)
});
const openShift = async (req, res, next) => {
    try {
        const { startAmount } = openShiftSchema.parse(req.body);
        const userId = req.user.id; // Auth middleware guarantees this
        const result = await cashShift_service_1.cashShiftService.openShift(userId, startAmount);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid data', error.issues);
        }
        if (error.message === 'User already has an open shift') {
            return (0, response_1.sendError)(res, 'SHIFT_ALREADY_OPEN', error.message, null, 409);
        }
        next(error);
    }
};
exports.openShift = openShift;
const closeShift = async (req, res, next) => {
    try {
        const { endAmount } = closeShiftSchema.parse(req.body);
        const userId = req.user.id;
        const result = await cashShift_service_1.cashShiftService.closeShift(userId, endAmount);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid data', error.issues);
        }
        if (error.message === 'No open shift found for this user') {
            return (0, response_1.sendError)(res, 'NO_OPEN_SHIFT', error.message, null, 404);
        }
        next(error);
    }
};
exports.closeShift = closeShift;
const getCurrentShift = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await cashShift_service_1.cashShiftService.getCurrentShift(userId);
        return (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        next(error);
    }
};
exports.getCurrentShift = getCurrentShift;
//# sourceMappingURL=cashShift.controller.js.map