import { Prisma } from '@prisma/client';
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
        byPaymentMethod: {
            method: string;
            count: number;
            total: number;
        }[];
    };
    cash: {
        startAmount: number;
        cashSales: number;
        expectedCash: number;
        countedCash: number | null;
        difference: number | null;
    };
}
export declare class CashShiftService {
    private getBusinessDate;
    openShift(userId: number, startAmount: number): Promise<{
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }>;
    closeShift(userId: number, endAmount: number): Promise<{
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }>;
    /**
     * Close shift with blind count (arqueo ciego)
     * The cashier counts cash without seeing expected amount first
     */
    closeShiftWithCount(userId: number, countedCash: number): Promise<ShiftReport>;
    /**
     * Calculate expected cash for a shift
     * startAmount + cash payments received
     */
    calculateExpectedCash(shiftId: number): Promise<number>;
    /**
     * Get detailed report for a shift
     */
    getShiftReport(shiftId: number): Promise<ShiftReport>;
    getCurrentShift(userId: number): Promise<({
        user: {
            name: string;
            email: string | null;
        };
    } & {
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }) | null>;
    getShiftHistory(userId: number, limit?: number): Promise<{
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }[]>;
    /**
     * Get all shifts with optional filters
     * Used by Dashboard analytics
     */
    getAll(filters?: {
        fromDate?: string;
        userId?: number;
    }): Promise<({
        user: {
            name: string;
        };
    } & {
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    })[]>;
}
export declare const cashShiftService: CashShiftService;
//# sourceMappingURL=cashShift.service.d.ts.map