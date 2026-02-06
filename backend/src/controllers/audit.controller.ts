import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';
import { AuditAction } from '@prisma/client';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const auditQuerySchema = z.object({
    userId: z.coerce.number().int().positive().optional(),
    entity: z.string().max(50).optional(),
    entityId: z.coerce.number().int().positive().optional(),
    action: z.nativeEnum(AuditAction).optional(),
    startDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

function parseDate(dateStr: string, end: boolean): Date {
    const parts = dateStr.split('-').map(Number);
    if (end) {
        return new Date(parts[0]!, parts[1]! - 1, parts[2]!, 23, 59, 59, 999);
    }
    return new Date(parts[0]!, parts[1]! - 1, parts[2]!, 0, 0, 0, 0);
}

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const params = auditQuerySchema.parse(req.query);

    const query: Parameters<typeof auditService.query>[0] = {
        tenantId: req.user!.tenantId!,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
    };
    if (params.userId !== undefined) query.userId = params.userId;
    if (params.entity !== undefined) query.entity = params.entity;
    if (params.entityId !== undefined) query.entityId = params.entityId;
    if (params.action !== undefined) query.action = params.action;
    if (params.startDate) query.startDate = parseDate(params.startDate, false);
    if (params.endDate) query.endDate = parseDate(params.endDate, true);

    const results = await auditService.query(query);
    sendSuccess(res, results);
});
