"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const prisma_1 = require("../lib/prisma");
/**
 * Audit service for immutable logging of critical system actions.
 * All logs are append-only and cannot be modified or deleted.
 */
class AuditService {
    /**
     * Log a critical action to the audit trail
     */
    async log(action, entity, entityId, context, details) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = {
                action,
                entity,
                entityId,
            };
            // Only add optional fields if they are defined
            if (context.userId !== undefined)
                data.userId = context.userId;
            if (context.ipAddress !== undefined)
                data.ipAddress = context.ipAddress;
            if (context.userAgent !== undefined)
                data.userAgent = context.userAgent;
            if (details !== undefined)
                data.details = details;
            await prisma_1.prisma.auditLog.create({ data });
        }
        catch (error) {
            // Never fail the main operation due to audit failure
            console.error('Audit log failed:', error);
        }
    }
    /**
     * Convenience: Log auth events
     */
    async logAuth(action, userId, context, details) {
        await this.log(action, 'User', userId ?? null, context, details);
    }
    /**
     * Convenience: Log order events
     */
    async logOrder(action, orderId, context, details) {
        await this.log(action, 'Order', orderId, context, details);
    }
    /**
     * Convenience: Log payment events
     */
    async logPayment(action, paymentId, context, details) {
        await this.log(action, 'Payment', paymentId, context, details);
    }
    /**
     * Convenience: Log cash shift events
     */
    async logCashShift(action, shiftId, context, details) {
        await this.log(action, 'CashShift', shiftId, context, details);
    }
    /**
     * Query audit logs with filters
     */
    async query(filters) {
        // Build where clause dynamically to avoid undefined values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where = {};
        if (filters.userId !== undefined)
            where.userId = filters.userId;
        if (filters.entity !== undefined)
            where.entity = filters.entity;
        if (filters.entityId !== undefined)
            where.entityId = filters.entityId;
        if (filters.action !== undefined)
            where.action = filters.action;
        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate)
                where.createdAt.gte = filters.startDate;
            if (filters.endDate)
                where.createdAt.lte = filters.endDate;
        }
        return prisma_1.prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 100,
            skip: filters.offset || 0
        });
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
//# sourceMappingURL=audit.service.js.map