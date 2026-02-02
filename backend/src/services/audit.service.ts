import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { AuditAction } from '@prisma/client';
import { logger } from '../utils/logger';

export interface AuditContext {
    userId?: number | undefined;
    tenantId?: number | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

/**
 * CQ-003: Shared helper to extract audit context from Express request.
 * Eliminates duplicate getAuditContext() in auth.controller and cashShift.controller.
 */
export function getAuditContext(req: Request): AuditContext {
    return {
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
    };
}

/**
 * Audit service for immutable logging of critical system actions.
 * All logs are append-only and cannot be modified or deleted.
 */
export class AuditService {
    /**
     * Log a critical action to the audit trail
     */
    async log(
        action: AuditAction,
        entity: string,
        entityId: number | null,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        try {
            // tenantId is required in the AuditLog schema — skip logging if missing
            if (context.tenantId === undefined || context.tenantId === null) {
                logger.warn(`[AUDIT] Skipping audit log for ${action} on ${entity}:${entityId} — no tenantId`);
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = {
                action,
                entity,
                entityId,
                tenantId: context.tenantId,
            };
            if (context.userId !== undefined) data.userId = context.userId;
            if (context.ipAddress !== undefined) data.ipAddress = context.ipAddress;
            if (context.userAgent !== undefined) data.userAgent = context.userAgent;
            if (details !== undefined) data.details = details;

            await prisma.auditLog.create({ data });
        } catch (error) {
            // ERR-004: Never fail the main operation, but log with full context for alerting
            logger.error('AUDIT_LOG_FAILED', {
                action,
                entity,
                entityId,
                tenantId: context.tenantId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    /**
     * Convenience: Log auth events
     */
    async logAuth(
        action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
        userId: number | undefined,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log(action, 'User', userId ?? null, context, details);
    }

    /**
     * Convenience: Log order events
     */
    async logOrder(
        action: 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'ORDER_REFUNDED',
        orderId: number,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log(action, 'Order', orderId, context, details);
    }

    /**
     * Convenience: Log payment events
     */
    async logPayment(
        action: 'PAYMENT_RECEIVED' | 'PAYMENT_VOIDED',
        paymentId: number,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log(action, 'Payment', paymentId, context, details);
    }

    /**
     * Convenience: Log cash shift events
     */
    async logCashShift(
        action: 'SHIFT_OPENED' | 'SHIFT_CLOSED' | 'CASH_ADJUSTMENT',
        shiftId: number,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log(action, 'CashShift', shiftId, context, details);
    }

    /**
     * Query audit logs with filters
     */
    // FIX P1-SEC-002: tenantId is now REQUIRED to prevent cross-tenant audit log exposure
    async query(filters: {
        tenantId: number;
        userId?: number;
        entity?: string;
        entityId?: number;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }) {
        // Build where clause dynamically to avoid undefined values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            tenantId: filters.tenantId // Always required
        };

        if (filters.userId !== undefined) where.userId = filters.userId;
        if (filters.entity !== undefined) where.entity = filters.entity;
        if (filters.entityId !== undefined) where.entityId = filters.entityId;
        if (filters.action !== undefined) where.action = filters.action;
        // Note: tenantId is set above as required — no conditional needed
        
        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) where.createdAt.gte = filters.startDate;
            if (filters.endDate) where.createdAt.lte = filters.endDate;
        }

        return prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 100,
            skip: filters.offset || 0
        });
    }
}

export const auditService = new AuditService();
