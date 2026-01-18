import { Request, Response } from 'express';
import { loginWithPin, register, loginWithPassword } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService } from '../services/audit.service';

/**
 * Extract audit context from request
 */
const getAuditContext = (req: Request) => ({
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
});

export const loginPin = asyncHandler(async (req: Request, res: Response) => {
    const { pin } = req.body;
    if (!pin) {
        return sendError(res, 'MISSING_PIN', 'PIN is required');
    }

    try {
        const result = await loginWithPin(pin);
        
        // Audit: Log successful PIN login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PIN',
            role: result.user.role
        });
        
        return sendSuccess(res, result);
    } catch (error) {
        // Audit: Log failed login attempt
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PIN',
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await register(req.body);
    
    // Audit: User registration is a significant security event
    await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
        method: 'REGISTER',
        role: result.user.role
    });
    
    return sendSuccess(res, result, undefined, 201);
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        const result = await loginWithPassword(req.body);
        
        // Audit: Log successful password login
        await auditService.logAuth('LOGIN', result.user.id, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            role: result.user.role
        });
        
        return sendSuccess(res, result);
    } catch (error) {
        // Audit: Log failed login attempt
        await auditService.logAuth('LOGIN_FAILED', undefined, getAuditContext(req), {
            method: 'PASSWORD',
            email: req.body.email,
            reason: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
});
