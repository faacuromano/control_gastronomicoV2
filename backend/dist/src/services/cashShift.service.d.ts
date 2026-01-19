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
    /**
     * Open a new cash shift for a user.
     * FIX RC-004: Atomic transaction prevents double shift opening under concurrent requests.
     */
    openShift(userId: number, startAmount: number): Promise<{
        id: number;
        userId: number;
        businessDate: Date;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }>;
    /**
     * Close the current shift for a user.
     * FIX RC-005: Atomic transaction prevents double closing under concurrent requests.
     */
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
    /**
     * Close shift with blind count (arqueo ciego).
     * FIX RC-005: Atomic transaction prevents double closing under concurrent requests.
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