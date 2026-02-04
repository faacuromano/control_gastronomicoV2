/**
 * @fileoverview Servicio de turnos de caja (Cash Shifts).
 *
 * Gestiona el ciclo de vida completo de los turnos de caja: apertura, cierre,
 * arqueo ciego (blind count), cálculo de efectivo esperado y generación de reportes.
 *
 * Los turnos son la unidad contable fundamental del POS: cada pago se asocia a un turno,
 * y al cerrar se compara el efectivo contado con el esperado para detectar diferencias.
 *
 * CONCURRENCIA: Las operaciones de apertura y cierre usan transacciones serializables
 * para prevenir condiciones de carrera (doble apertura/cierre simultáneo).
 *
 * @module services/cashShift.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';
import { getBusinessDate } from '../utils/businessDate';

export interface ShiftReport {
    shift: {
        id: number;
        startTime: Date;
        endTime: Date | null;
        startAmount: number;
        endAmount: number | null;
        userName: string;
    };
    sales: {
        totalOrders: number;
        totalSales: number;
        byPaymentMethod: { method: string; count: number; total: number }[];
    };
    cash: {
        startAmount: number;
        cashSales: number;
        expectedCash: number;
        countedCash: number | null;
        difference: number | null;
    };
}

export class CashShiftService {

    /**
     * Abre un nuevo turno de caja para un usuario.
     * FIX RC-004: Transacción atómica con nivel Serializable previene apertura doble bajo concurrencia.
     */
    async openShift(tenantId: number, userId: number, startAmount: number) {
        const businessDate = getBusinessDate(new Date());

        // FIX RC-004: Verificación y creación dentro de transacción atómica
        return await prisma.$transaction(async (tx) => {
            // Verificar dentro de la transacción para evitar condición de carrera
            const existingShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    tenantId,
                    endTime: null
                }
            });

            if (existingShift) {
                throw new ConflictError('User already has an open shift');
            }

            return await tx.cashShift.create({
                data: {
                    tenantId,
                    userId,
                    startAmount,
                    businessDate,
                    startTime: new Date()
                }
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 5000
        });
    }

    /**
     * Cierra el turno activo de un usuario.
     * FIX RC-005: Transacción atómica con nivel Serializable previene cierre doble bajo concurrencia.
     * Valida que no haya mesas ocupadas antes de permitir el cierre.
     */
    async closeShift(tenantId: number, userId: number, endAmount: number) {
        // FIX RC-005: Toda la operación en transacción atómica
        return await prisma.$transaction(async (tx) => {
            const currentShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    tenantId,
                    endTime: null
                }
            });

            if (!currentShift) {
                throw new NotFoundError('No open shift found for this user');
            }

            // Verificar mesas ocupadas dentro de la transacción (aislado por tenant)
            const openTables = await tx.table.count({
                where: {
                    status: 'OCCUPIED',
                    tenantId: currentShift.tenantId
                }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

            // SAFE: tx.cashShift.findFirst en L86 verifica propiedad del tenant
            return await tx.cashShift.update({
                where: { id: currentShift.id },
                data: {
                    endTime: new Date(),
                    endAmount
                }
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 5000
        });
    }

    /**
     * Cierra el turno con arqueo ciego (blind count / arqueo de caja).
     * El cajero cuenta el efectivo sin saber cuánto debería haber; el sistema calcula la diferencia.
     * FIX RC-005: Transacción atómica previene cierre doble bajo concurrencia.
     */
    async closeShiftWithCount(tenantId: number, userId: number, countedCash: number) {
        // FIX RC-005: Envolver en transacción para atomicidad
        const closedShiftId = await prisma.$transaction(async (tx) => {
            const currentShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    tenantId,
                    endTime: null
                }
            });

            if (!currentShift) {
                throw new NotFoundError('No open shift found for this user');
            }

            // Verificar mesas ocupadas dentro de la transacción (aislado por tenant)
            const openTables = await tx.table.count({
                where: { status: 'OCCUPIED', tenantId: currentShift.tenantId }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

            // SAFE: tx.cashShift.findFirst en L134 verifica propiedad del tenant
            const closedShift = await tx.cashShift.update({
                where: { id: currentShift.id },
                data: {
                    endTime: new Date(),
                    endAmount: countedCash
                }
            });

            return closedShift.id;
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 5000
        });

        // Generar reporte fuera de la transacción (solo lectura)
        return await this.getShiftReport(closedShiftId, tenantId);
    }

    /**
     * Calcula el efectivo esperado en caja para un turno.
     * Fórmula: monto inicial + total de pagos en efectivo del turno.
     */
    async calculateExpectedCash(shiftId: number, tenantId: number): Promise<number> {
        const shift = await prisma.cashShift.findFirst({
            where: { id: shiftId, tenantId }
        });

        if (!shift) {
            throw new NotFoundError('Shift not found');
        }

        // Sumar todos los pagos en EFECTIVO asociados a este turno
        const cashPayments = await prisma.payment.aggregate({
            where: {
                shiftId: shiftId,
                tenantId,
                method: 'CASH'
            },
            _sum: {
                amount: true
            }
        });

        const startAmount = Number(shift.startAmount);
        const cashSales = Number(cashPayments._sum.amount || 0);

        return startAmount + cashSales;
    }

    /**
     * Genera el reporte detallado de un turno de caja.
     * Incluye: datos del turno, ventas por método de pago, y conciliación de efectivo.
     */
    async getShiftReport(shiftId: number, tenantId: number): Promise<ShiftReport> {
        const shift = await prisma.cashShift.findFirst({
            where: { id: shiftId, tenantId },
            include: {
                user: { select: { name: true } },
                payments: true
            }
        });

        if (!shift) {
            throw new NotFoundError('Shift not found');
        }

        // Agrupar pagos por método de pago para el desglose
        const paymentsByMethod = await prisma.payment.groupBy({
            by: ['method'],
            where: { shiftId: shiftId, tenantId: shift.tenantId },
            _sum: { amount: true },
            _count: true
        });

        // Contar órdenes únicas que tuvieron pagos en este turno
        const orderIds = [...new Set(shift.payments.map(p => p.orderId))];
        const totalSales = shift.payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Calcular métricas específicas de efectivo para la conciliación
        const cashPayments = paymentsByMethod.find(p => p.method === 'CASH');
        const cashSales = Number(cashPayments?._sum.amount || 0);
        const startAmount = Number(shift.startAmount);
        const expectedCash = startAmount + cashSales;
        const countedCash = shift.endAmount ? Number(shift.endAmount) : null;
        const difference = countedCash !== null ? countedCash - expectedCash : null;

        return {
            shift: {
                id: shift.id,
                startTime: shift.startTime,
                endTime: shift.endTime,
                startAmount: startAmount,
                endAmount: countedCash,
                userName: shift.user.name
            },
            sales: {
                totalOrders: orderIds.length,
                totalSales: totalSales,
                byPaymentMethod: paymentsByMethod.map(p => ({
                    method: p.method,
                    count: p._count,
                    total: Number(p._sum.amount || 0)
                }))
            },
            cash: {
                startAmount: startAmount,
                cashSales: cashSales,
                expectedCash: expectedCash,
                countedCash: countedCash,
                difference: difference
            }
        };
    }

    /**
     * Obtiene el turno activo (abierto) del usuario actual.
     */
    async getCurrentShift(tenantId: number, userId: number) {
        return await prisma.cashShift.findFirst({
            where: {
                userId,
                tenantId,
                endTime: null
            },
            include: {
                user: { select: { name: true, email: true } }
            }
        });
    }

    /**
     * Obtiene el historial de turnos de un usuario.
     * DB-001: Recibe tenantId del caller (JWT) para aislamiento multi-inquilino
     * sin necesidad de una query adicional.
     */
    async getShiftHistory(userId: number, tenantId: number, limit = 10) {
        // PERF-013: Limitar resultados para evitar consultas sin cota
        return await prisma.cashShift.findMany({
            where: {
                userId,
                tenantId
            },
            orderBy: { startTime: 'desc' },
            take: Math.min(limit, 100)
        });
    }

    /**
     * Obtiene todos los turnos con filtros opcionales.
     * Usado por el Dashboard de analíticas para supervisión gerencial.
     */
    async getAll(tenantId: number, filters?: { fromDate?: string; userId?: number }) {
        const where: Prisma.CashShiftWhereInput = { tenantId };

        if (filters?.fromDate) {
            where.businessDate = {
                gte: new Date(filters.fromDate)
            };
        }

        if (filters?.userId) {
            where.userId = filters.userId;
        }

        return await prisma.cashShift.findMany({
            where,
            orderBy: { startTime: 'desc' },
            include: {
                user: { select: { name: true } }
            },
            take: 200
        });
    }
}

export const cashShiftService = new CashShiftService();
