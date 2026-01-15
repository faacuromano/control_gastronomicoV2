import { Request, Response, NextFunction } from 'express';
import { loginWithPin, register, loginWithPassword } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';

export const loginPin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { pin } = req.body;
        if (!pin) {
            return sendError(res, 'MISSING_PIN', 'PIN is required');
        }

        const result = await loginWithPin(pin);
        return sendSuccess(res, result);
    } catch (error: any) {
        if (error.code) {
            return sendError(res, error.code, error.message, error.details || null, 401);
        }
        next(error);
    }
};

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await register(req.body);
        return sendSuccess(res, result, undefined, 201);
    } catch (error: any) {
        if (error.code) {
            const status = error.code === 'VALIDATION_ERROR' ? 400 : error.code === 'USER_EXISTS' ? 409 : 500;
            return sendError(res, error.code, error.message, error.details || null, status);
        }
        next(error);
    }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await loginWithPassword(req.body);
        return sendSuccess(res, result);
    } catch (error: any) {
        if (error.code) {
            return sendError(res, error.code, error.message, error.details || null, 401);
        }
        next(error);
    }
};
