import { Prisma } from '@prisma/client';
export declare class CashShiftService {
    private getBusinessDate;
    openShift(userId: number, startAmount: number): Promise<{
        id: number;
        businessDate: Date;
        userId: number;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }>;
    closeShift(userId: number, endAmount: number): Promise<{
        id: number;
        businessDate: Date;
        userId: number;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }>;
    getCurrentShift(userId: number): Promise<({
        user: {
            name: string;
            email: string | null;
        };
    } & {
        id: number;
        businessDate: Date;
        userId: number;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }) | null>;
    getShiftHistory(userId: number, limit?: number): Promise<{
        id: number;
        businessDate: Date;
        userId: number;
        startTime: Date;
        endTime: Date | null;
        startAmount: Prisma.Decimal;
        endAmount: Prisma.Decimal | null;
    }[]>;
}
export declare const cashShiftService: CashShiftService;
//# sourceMappingURL=cashShift.service.d.ts.map