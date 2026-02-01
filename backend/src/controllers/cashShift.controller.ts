import { Request, Response } from 'express';
import { cashShiftService } from '../services/cashShift.service';
import { sendSuccess } from '../utils/response';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { auditService } from '../services/audit.service';

const openShiftSchema = z.object({
    startAmount: z.number().min(0)
});

const closeShiftSchema = z.object({
    countedCash: z.number().min(0)
});

/**
 * Extract audit context from request
 */
const getAuditContext = (req: Request) => ({
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
});

export const openShift = asyncHandler(async (req: Request, res: Response) => {
    const { startAmount } = openShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();
    
    const result = await cashShiftService.openShift(req.user!.tenantId!, userId, startAmount);
    
    // Audit: Log shift opening
    await auditService.logCashShift('SHIFT_OPENED', result.id, getAuditContext(req), {
        startAmount,
        userName: req.user?.name
    });
    
    return sendSuccess(res, result);
});

export const closeShiftWithCount = asyncHandler(async (req: Request, res: Response) => {
    const { countedCash } = closeShiftSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();
    
    const report = await cashShiftService.closeShiftWithCount(req.user!.tenantId!, userId, countedCash);
    
    // Audit: Log shift closing with cash count
    await auditService.logCashShift('SHIFT_CLOSED', report.shift.id, getAuditContext(req), {
        countedCash,
        expectedCash: report.cash.expectedCash,
        difference: report.cash.difference,
        totalSales: report.sales.totalSales
    });
    
    return sendSuccess(res, report);
});

export const getShiftReport = asyncHandler(async (req: Request, res: Response) => {
    const shiftId = Number(req.params.id);
    if (!shiftId || isNaN(shiftId)) {
        throw new ValidationError('Invalid shift ID');
    }
    const report = await cashShiftService.getShiftReport(shiftId, req.user!.tenantId!);
    return sendSuccess(res, report);
});

export const getCurrentShift = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();
    
    const result = await cashShiftService.getCurrentShift(req.user!.tenantId!, userId);
    return sendSuccess(res, result);
});

// Keep legacy closeShift for backwards compatibility
export const closeShift = asyncHandler(async (req: Request, res: Response) => {
    const { endAmount } = z.object({ endAmount: z.number().min(0) }).parse(req.body);
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError();
    
    const result = await cashShiftService.closeShift(req.user!.tenantId!, userId, endAmount);
    
    // Audit: Log shift closing
    await auditService.logCashShift('SHIFT_CLOSED', result.id, getAuditContext(req), {
        endAmount,
        userName: req.user?.name
    });
    
    return sendSuccess(res, result);
});

/**
 * Get all shifts with optional filters (for Dashboard analytics)
 */
export const getAllShifts = asyncHandler(async (req: Request, res: Response) => {
    const fromDate = req.query.fromDate as string | undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    
    // FIX IP-006: Validate ISO 8601 date format
    if (fromDate) {
        const dateSchema = z.string().datetime();
        const validation = dateSchema.safeParse(fromDate);
        if (!validation.success) {
            throw new ValidationError(`Invalid date format for fromDate. Expected ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ), got: ${fromDate}`);
        }
    }
    
    // Build filters object with only defined values
    const filters: { fromDate?: string; userId?: number } = {};
    if (fromDate) filters.fromDate = fromDate;
    if (userId) filters.userId = userId;
    
    const shifts = await cashShiftService.getAll(req.user!.tenantId!, filters);
    return sendSuccess(res, shifts);
});
