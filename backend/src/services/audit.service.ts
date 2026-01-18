import { prisma } from '../lib/prisma';
import { AuditAction } from '@prisma/client';

export interface AuditContext {
    userId?: number | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = {
                action,
                entity,
                entityId,
            };
            
            // Only add optional fields if they are defined
            if (context.userId !== undefined) data.userId = context.userId;
            if (context.ipAddress !== undefined) data.ipAddress = context.ipAddress;
            if (context.userAgent !== undefined) data.userAgent = context.userAgent;
            if (details !== undefined) data.details = details;

            await prisma.auditLog.create({ data });
        } catch (error) {
            // Never fail the main operation due to audit failure
            console.error('Audit log failed:', error);
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
    async query(filters: {
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
        const where: any = {};
        
        if (filters.userId !== undefined) where.userId = filters.userId;
        if (filters.entity !== undefined) where.entity = filters.entity;
        if (filters.entityId !== undefined) where.entityId = filters.entityId;
        if (filters.action !== undefined) where.action = filters.action;
        
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
