"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashShiftService = exports.CashShiftService = void 0;
const prisma_1 = require("../lib/prisma");
class CashShiftService {
    getBusinessDate(date) {
        const businessDate = new Date(date);
        // If hour < 6 AM, it belongs to previous day
        if (businessDate.getHours() < 6) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        // Normalize time to midnight/noon? Usually just the Date part matters for grouping
        businessDate.setHours(0, 0, 0, 0);
        return businessDate;
    }
    async openShift(userId, startAmount) {
        // Check if user already has an open shift
        const existingShift = await prisma_1.prisma.cashShift.findFirst({
            where: {
                userId,
                endTime: null
            }
        });
        if (existingShift) {
            throw new Error('User already has an open shift');
        }
        const businessDate = this.getBusinessDate(new Date());
        return await prisma_1.prisma.cashShift.create({
            data: {
                userId,
                startAmount,
                businessDate,
                startTime: new Date()
            }
        });
    }
    async closeShift(userId, endAmount) {
        const currentShift = await this.getCurrentShift(userId);
        if (!currentShift) {
            throw new Error('No open shift found for this user');
        }
        return await prisma_1.prisma.cashShift.update({
            where: { id: currentShift.id },
            data: {
                endTime: new Date(),
                endAmount
            }
        });
    }
    async getCurrentShift(userId) {
        return await prisma_1.prisma.cashShift.findFirst({
            where: {
                userId,
                endTime: null
            },
            include: {
                user: { select: { name: true, email: true } }
            }
        });
    }
    async getShiftHistory(userId, limit = 10) {
        return await prisma_1.prisma.cashShift.findMany({
            where: { userId },
            orderBy: { startTime: 'desc' },
            take: limit
        });
    }
}
exports.CashShiftService = CashShiftService;
exports.cashShiftService = new CashShiftService();
//# sourceMappingURL=cashShift.service.js.map