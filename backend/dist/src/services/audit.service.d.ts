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
export declare class AuditService {
    /**
     * Log a critical action to the audit trail
     */
    log(action: AuditAction, entity: string, entityId: number | null, context: AuditContext, details?: Record<string, unknown>): Promise<void>;
    /**
     * Convenience: Log auth events
     */
    logAuth(action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED', userId: number | undefined, context: AuditContext, details?: Record<string, unknown>): Promise<void>;
    /**
     * Convenience: Log order events
     */
    logOrder(action: 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'ORDER_REFUNDED', orderId: number, context: AuditContext, details?: Record<string, unknown>): Promise<void>;
    /**
     * Convenience: Log payment events
     */
    logPayment(action: 'PAYMENT_RECEIVED' | 'PAYMENT_VOIDED', paymentId: number, context: AuditContext, details?: Record<string, unknown>): Promise<void>;
    /**
     * Convenience: Log cash shift events
     */
    logCashShift(action: 'SHIFT_OPENED' | 'SHIFT_CLOSED' | 'CASH_ADJUSTMENT', shiftId: number, context: AuditContext, details?: Record<string, unknown>): Promise<void>;
    /**
     * Query audit logs with filters
     */
    query(filters: {
        userId?: number;
        entity?: string;
        entityId?: number;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        userId: number | null;
        action: import(".prisma/client").$Enums.AuditAction;
        entity: string;
        entityId: number | null;
        details: import("@prisma/client/runtime/library").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
    }[]>;
}
export declare const auditService: AuditService;
//# sourceMappingURL=audit.service.d.ts.map