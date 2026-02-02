/**
 * @fileoverview Servicio de auditoría para registro inmutable de acciones críticas del sistema.
 *
 * Todos los registros de auditoría son de solo escritura (append-only) y no pueden
 * ser modificados ni eliminados. Esto garantiza trazabilidad completa para cumplimiento
 * normativo y resolución de incidentes.
 *
 * @module services/audit.service
 */

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
 * CQ-003: Helper compartido para extraer contexto de auditoría desde un Request de Express.
 * Elimina la duplicación de getAuditContext() que existía en auth.controller y cashShift.controller.
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
 * Servicio de auditoría para registro inmutable de acciones críticas.
 * Todos los logs son append-only: no se pueden modificar ni eliminar.
 */
export class AuditService {
    /**
     * Registra una acción crítica en la pista de auditoría.
     * Si falla el registro, NO interrumpe la operación principal (fail-open).
     */
    async log(
        action: AuditAction,
        entity: string,
        entityId: number | null,
        context: AuditContext,
        details?: Record<string, unknown>
    ): Promise<void> {
        try {
            // tenantId es obligatorio en el esquema AuditLog — si falta, no se puede guardar
            if (context.tenantId === undefined || context.tenantId === null) {
                logger.warn(`[AUDIT] Omitiendo registro de auditoría para ${action} en ${entity}:${entityId} — falta tenantId`);
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
            // ERR-004: Nunca fallar la operación principal; registrar con contexto completo para alertas
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
     * Atajo para registrar eventos de autenticación (login, logout, intentos fallidos).
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
     * Atajo para registrar eventos de órdenes (creación, cancelación, reembolso).
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
     * Atajo para registrar eventos de pagos (recepción, anulación).
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
     * Atajo para registrar eventos de turnos de caja (apertura, cierre, ajuste).
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
     * Consulta registros de auditoría con filtros dinámicos.
     * tenantId es OBLIGATORIO para evitar exposición cross-tenant (FIX P1-SEC-002).
     */
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
        // Construir cláusula WHERE dinámicamente, omitiendo valores undefined
        const where: Prisma.AuditLogWhereInput = {
            tenantId: filters.tenantId, // Siempre obligatorio
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
