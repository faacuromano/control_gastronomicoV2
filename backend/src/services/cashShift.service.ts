
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';

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
    
    private getBusinessDate(date: Date): Date {
        const businessDate = new Date(date);
        // If hour < 6 AM, it belongs to previous day
        if (businessDate.getHours() < 6) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        // Normalize time to midnight/noon? Usually just the Date part matters for grouping
        businessDate.setHours(0, 0, 0, 0);
        return businessDate;
    }

    /**
     * Open a new cash shift for a user.
     * FIX RC-004: Atomic transaction prevents double shift opening under concurrent requests.
     */
    async openShift(tenantId: number, userId: number, startAmount: number) {
        const businessDate = this.getBusinessDate(new Date());

        // FIX RC-004: Wrap check + create in atomic transaction
        return await prisma.$transaction(async (tx) => {
            // Check inside transaction - prevents race condition
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
     * Close the current shift for a user.
     * FIX RC-005: Atomic transaction prevents double closing under concurrent requests.
     */
    async closeShift(tenantId: number, userId: number, endAmount: number) {
        // FIX RC-005: Entire operation in atomic transaction
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

            // Check for open tables inside transaction (scoped to tenant)
            const openTables = await tx.table.count({
                where: {
                    status: 'OCCUPIED',
                    tenantId: currentShift.tenantId
                }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

            // SAFE: tx.cashShift.findFirst L86 verifies tenant ownership
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
     * Close shift with blind count (arqueo ciego).
     * FIX RC-005: Atomic transaction prevents double closing under concurrent requests.
     */
    async closeShiftWithCount(tenantId: number, userId: number, countedCash: number) {
        // FIX RC-005: Wrap in transaction for atomicity
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

            // Check for open tables inside transaction (scoped to tenant)
            const openTables = await tx.table.count({
                where: { status: 'OCCUPIED', tenantId: currentShift.tenantId }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

            // SAFE: tx.cashShift.findFirst L134 verifies tenant ownership
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

        // Return report (outside transaction - read-only)
        return await this.getShiftReport(closedShiftId, tenantId);
    }

    /**
     * Calculate expected cash for a shift
     * startAmount + cash payments received
     */
    async calculateExpectedCash(shiftId: number, tenantId: number): Promise<number> {
        const shift = await prisma.cashShift.findFirst({
            where: { id: shiftId, tenantId }
        });

        if (!shift) {
            throw new NotFoundError('Shift not found');
        }

        // Get all CASH payments for this shift
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
     * Get detailed report for a shift
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

        // Get payments grouped by method
        const paymentsByMethod = await prisma.payment.groupBy({
            by: ['method'],
            where: { shiftId: shiftId, tenantId: shift.tenantId },
            _sum: { amount: true },
            _count: true
        });

        // Get total orders for this shift (orders that have payments in this shift)
        const orderIds = [...new Set(shift.payments.map(p => p.orderId))];
        const totalSales = shift.payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Calculate cash specifics
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

    async getShiftHistory(userId: number, limit = 10) {
        // Get user to obtain tenantId for multi-tenant isolation
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tenantId: true }
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return await prisma.cashShift.findMany({
            where: {
                userId,
                tenantId: user.tenantId
            },
            orderBy: { startTime: 'desc' },
            take: limit
        });
    }

    /**
     * Get all shifts with optional filters
     * Used by Dashboard analytics
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
            }
        });
    }
}

export const cashShiftService = new CashShiftService();
