
import { prisma } from '../lib/prisma';
import { getBusinessDate } from '../utils/businessDate';
import { logger } from '../utils/logger';

export class BusinessDateService {
    
    /**
     * Determines the operational Business Date for a transaction.
     * 
     * FALLBACK STRATEGY (The "KISS" Rule):
     * 1. If User has an Active Shift -> Use Shift's Business Date (Robustness)
     * 2. If NO Active Shift (Webhook, Early Waiter, Admin) -> Use System Clock with 6 AM Rule (Availability)
     * 
     * This logic ensures operations are never blocked by "No Shift", 
     * while guaranteeing that waiters working late night stay on the "Previous Day".
     */
    async determineBusinessDate(tenantId: number, userId?: number): Promise<Date> {
        // Scenario 1: User Context Available (Waiter/Cashier)
        if (userId) {
            const activeShift = await prisma.cashShift.findFirst({
                where: {
                    userId,
                    tenantId,
                    endTime: null
                }
            });

            if (activeShift) {
                // BIZ-011: Validate shift business date is not stale (> 2 days old)
                const now = new Date();
                const diffMs = now.getTime() - activeShift.businessDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (diffDays > 2) {
                    logger.warn('STALE_BUSINESS_DATE', {
                        tenantId,
                        userId,
                        shiftId: activeShift.id,
                        shiftBusinessDate: activeShift.businessDate.toISOString(),
                        staleDays: Math.floor(diffDays),
                        action: 'USING_SYSTEM_DATE_FALLBACK'
                    });
                    // Fall through to system clock fallback instead of using stale date
                } else {
                    return activeShift.businessDate;
                }
            }
        }

        // Scenario 2: No Shift or System Operation (Webhook/Admin)
        // FALLBACK: Use System Clock with standard 6 AM Rule
        const systemDate = getBusinessDate(new Date());
        
        logger.debug('BUSINESS_DATE_FALLBACK', {
            tenantId,
            userId,
            determinedDate: systemDate.toISOString().split('T')[0],
            reason: userId ? 'NO_ACTIVE_SHIFT' : 'SYSTEM_OPERATION'
        });

        return systemDate;
    }
}

export const businessDateService = new BusinessDateService();
