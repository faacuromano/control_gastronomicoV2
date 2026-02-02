import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { AuditAction, Prisma } from '@prisma/client';
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

            const data: Prisma.AuditLogUncheckedCreateInput = {
                action,
                entity,
                entityId,
                tenantId: context.tenantId!,
                ...(context.userId !== undefined && { userId: context.userId }),
                ...(context.ipAddress !== undefined && { ipAddress: context.ipAddress }),
                ...(context.userAgent !== undefined && { userAgent: context.userAgent }),
                ...(details !== undefined && { details: details as Prisma.InputJsonValue }),
            };

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
        const where: Prisma.AuditLogWhereInput = {
            tenantId: filters.tenantId, // Always required
            ...(filters.userId !== undefined && { userId: filters.userId }),
            ...(filters.entity !== undefined && { entity: filters.entity }),
            ...(filters.entityId !== undefined && { entityId: filters.entityId }),
            ...(filters.action !== undefined && { action: filters.action }),
            ...((filters.startDate || filters.endDate) && {
                createdAt: {
                    ...(filters.startDate && { gte: filters.startDate }),
                    ...(filters.endDate && { lte: filters.endDate }),
                },
            }),
        };

        return prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 100,
            skip: filters.offset || 0
        });
    }
}

export const auditService = new AuditService();
