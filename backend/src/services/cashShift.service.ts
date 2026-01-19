
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
    async openShift(userId: number, startAmount: number) {
        // Verify user exists outside transaction (read-only, no race impact)
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundError('User not found. Please log in again.');
        }

        const businessDate = this.getBusinessDate(new Date());

        // FIX RC-004: Wrap check + create in atomic transaction
        return await prisma.$transaction(async (tx) => {
            // Check inside transaction - prevents race condition
            const existingShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    endTime: null
                }
            });

            if (existingShift) {
                throw new ConflictError('User already has an open shift');
            }

            return await tx.cashShift.create({
                data: {
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
    async closeShift(userId: number, endAmount: number) {
        // FIX RC-005: Entire operation in atomic transaction
        return await prisma.$transaction(async (tx) => {
            const currentShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    endTime: null
                }
            });

            if (!currentShift) {
                throw new NotFoundError('No open shift found for this user');
            }

            // Check for open tables inside transaction
            const openTables = await tx.table.count({
                where: { status: 'OCCUPIED' }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

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
     * Close shift with blind count (arqueo ciego)
     * The cashier counts cash without seeing expected amount first
     */
    /**
     * Close shift with blind count (arqueo ciego).
     * FIX RC-005: Atomic transaction prevents double closing under concurrent requests.
     */
    async closeShiftWithCount(userId: number, countedCash: number) {
        // FIX RC-005: Wrap in transaction for atomicity
        const closedShiftId = await prisma.$transaction(async (tx) => {
            const currentShift = await tx.cashShift.findFirst({
                where: {
                    userId,
                    endTime: null
                }
            });

            if (!currentShift) {
                throw new NotFoundError('No open shift found for this user');
            }

            // Check for open tables inside transaction
            const openTables = await tx.table.count({
                where: { status: 'OCCUPIED' }
            });

            if (openTables > 0) {
                throw new ConflictError(`Cannot close shift. There are ${openTables} occupied tables. Please close them first.`);
            }

            // Close the shift
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
        return await this.getShiftReport(closedShiftId);
    }

    /**
     * Calculate expected cash for a shift
     * startAmount + cash payments received
     */
    async calculateExpectedCash(shiftId: number): Promise<number> {
        const shift = await prisma.cashShift.findUnique({
            where: { id: shiftId }
        });

        if (!shift) {
            throw new NotFoundError('Shift not found');
        }

        // Get all CASH payments for this shift
        const cashPayments = await prisma.payment.aggregate({
            where: {
                shiftId: shiftId,
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
    async getShiftReport(shiftId: number): Promise<ShiftReport> {
        const shift = await prisma.cashShift.findUnique({
            where: { id: shiftId },
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
            where: { shiftId: shiftId },
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

    async getCurrentShift(userId: number) {
        return await prisma.cashShift.findFirst({
            where: {
                userId,
                endTime: null
            },
            include: {
                user: { select: { name: true, email: true } }
            }
        });
    }

    async getShiftHistory(userId: number, limit = 10) {
        return await prisma.cashShift.findMany({
            where: { userId },
            orderBy: { startTime: 'desc' },
            take: limit
        });
    }

    /**
     * Get all shifts with optional filters
     * Used by Dashboard analytics
     */
    async getAll(filters?: { fromDate?: string; userId?: number }) {
        const where: Prisma.CashShiftWhereInput = {};

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
