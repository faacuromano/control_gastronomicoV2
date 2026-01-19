"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllShifts = exports.closeShift = exports.getCurrentShift = exports.getShiftReport = exports.closeShiftWithCount = exports.openShift = void 0;
const cashShift_service_1 = require("../services/cashShift.service");
const response_1 = require("../utils/response");
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errors_1 = require("../utils/errors");
const audit_service_1 = require("../services/audit.service");
const openShiftSchema = zod_1.z.object({
    startAmount: zod_1.z.number().min(0)
});
const closeShiftSchema = zod_1.z.object({
    countedCash: zod_1.z.number().min(0)
});
/**
 * Extract audit context from request
 */
const getAuditContext = (req) => ({
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
});
exports.openShift = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { startAmount } = openShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId)
        throw new errors_1.UnauthorizedError();
    const result = await cashShift_service_1.cashShiftService.openShift(userId, startAmount);
    // Audit: Log shift opening
    await audit_service_1.auditService.logCashShift('SHIFT_OPENED', result.id, getAuditContext(req), {
        startAmount,
        userName: req.user?.name
    });
    return (0, response_1.sendSuccess)(res, result);
});
exports.closeShiftWithCount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { countedCash } = closeShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId)
        throw new errors_1.UnauthorizedError();
    const report = await cashShift_service_1.cashShiftService.closeShiftWithCount(userId, countedCash);
    // Audit: Log shift closing with cash count
    await audit_service_1.auditService.logCashShift('SHIFT_CLOSED', report.shift.id, getAuditContext(req), {
        countedCash,
        expectedCash: report.cash.expectedCash,
        difference: report.cash.difference,
        totalSales: report.sales.totalSales
    });
    return (0, response_1.sendSuccess)(res, report);
});
exports.getShiftReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const shiftId = Number(req.params.id);
    if (!shiftId || isNaN(shiftId)) {
        throw new errors_1.ValidationError('Invalid shift ID');
    }
    const report = await cashShift_service_1.cashShiftService.getShiftReport(shiftId);
    return (0, response_1.sendSuccess)(res, report);
});
exports.getCurrentShift = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        throw new errors_1.UnauthorizedError();
    const result = await cashShift_service_1.cashShiftService.getCurrentShift(userId);
    return (0, response_1.sendSuccess)(res, result);
});
// Keep legacy closeShift for backwards compatibility
exports.closeShift = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { endAmount } = zod_1.z.object({ endAmount: zod_1.z.number().min(0) }).parse(req.body);
    const userId = req.user?.id;
    if (!userId)
        throw new errors_1.UnauthorizedError();
    const result = await cashShift_service_1.cashShiftService.closeShift(userId, endAmount);
    // Audit: Log shift closing
    await audit_service_1.auditService.logCashShift('SHIFT_CLOSED', result.id, getAuditContext(req), {
        endAmount,
        userName: req.user?.name
    });
    return (0, response_1.sendSuccess)(res, result);
});
/**
 * Get all shifts with optional filters (for Dashboard analytics)
 */
exports.getAllShifts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const fromDate = req.query.fromDate;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    // FIX IP-006: Validate ISO 8601 date format
    if (fromDate) {
        const dateSchema = zod_1.z.string().datetime();
        const validation = dateSchema.safeParse(fromDate);
        if (!validation.success) {
            throw new errors_1.ValidationError(`Invalid date format for fromDate. Expected ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ), got: ${fromDate}`);
        }
    }
    // Build filters object with only defined values
    const filters = {};
    if (fromDate)
        filters.fromDate = fromDate;
    if (userId)
        filters.userId = userId;
    const shifts = await cashShift_service_1.cashShiftService.getAll(filters);
    return (0, response_1.sendSuccess)(res, shifts);
});
//# sourceMappingURL=cashShift.controller.js.map