
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
                // LOGIC: Inherit from Shift (Robustness)
                // Even if clock says 04:00 AM (Next Day), strict adherence to Shift's date
                return activeShift.businessDate;
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
