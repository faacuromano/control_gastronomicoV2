
import { Request, Response, NextFunction } from 'express';
import { cashShiftService } from '../services/cashShift.service';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const openShiftSchema = z.object({
    startAmount: z.number().min(0)
});

const closeShiftSchema = z.object({
    countedCash: z.number().min(0)
});

export const openShift = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startAmount } = openShiftSchema.parse(req.body);
        const userId = (req as any).user!.id;
        const result = await cashShiftService.openShift(userId, startAmount);
        return sendSuccess(res, result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
             return sendError(res, 'VALIDATION_ERROR', 'Invalid data', error.issues);
        }
        next(error);
    }
};

export const closeShiftWithCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { countedCash } = closeShiftSchema.parse(req.body);
        const userId = (req as any).user!.id;
        const report = await cashShiftService.closeShiftWithCount(userId, countedCash);
        return sendSuccess(res, report);
    } catch (error: any) {
         if (error instanceof z.ZodError) {
             return sendError(res, 'VALIDATION_ERROR', 'Invalid data', error.issues);
        }
        next(error);
    }
};

export const getShiftReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const shiftId = Number(req.params.id);
        if (!shiftId || isNaN(shiftId)) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid shift ID', null, 400);
        }
        const report = await cashShiftService.getShiftReport(shiftId);
        return sendSuccess(res, report);
    } catch (error) {
        next(error);
    }
};

export const getCurrentShift = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;
        const result = await cashShiftService.getCurrentShift(userId);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

// Keep legacy closeShift for backwards compatibility
export const closeShift = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { endAmount } = z.object({ endAmount: z.number().min(0) }).parse(req.body);
        const userId = (req as any).user!.id;
        const result = await cashShiftService.closeShift(userId, endAmount);
        return sendSuccess(res, result);
    } catch (error: any) {
         if (error instanceof z.ZodError) {
             return sendError(res, 'VALIDATION_ERROR', 'Invalid data', error.issues);
        }
        next(error);
    }
};
