/**
 * @fileoverview Servicio de fecha de negocio (Business Date).
 *
 * En gastronomía, la "fecha de negocio" no siempre coincide con la fecha calendario.
 * Un restaurante que cierra a las 3 AM considera esas ventas como parte del día anterior.
 * Este servicio determina la fecha operativa correcta para cada transacción.
 *
 * ESTRATEGIA DE RESOLUCIÓN (Regla "KISS"):
 * 1. Si el usuario tiene un turno activo -> usar la fecha del turno (robustez)
 * 2. Si NO hay turno activo (webhook, admin, mesero temprano) -> usar reloj del sistema con regla de las 6 AM
 *
 * @module services/businessDate.service
 */

import { prisma } from '../lib/prisma';
import { getBusinessDate } from '../utils/businessDate';
import { logger } from '../utils/logger';

export class BusinessDateService {

    /**
     * Determina la fecha de negocio operativa para una transacción.
     *
     * ESTRATEGIA DE FALLBACK:
     * 1. Si el usuario tiene un turno abierto -> usa la fecha del turno (garantiza consistencia)
     * 2. Si NO hay turno activo (webhook, admin, madrugada) -> usa reloj del sistema con regla de 6 AM
     *
     * Esto asegura que las operaciones nunca se bloqueen por "falta de turno",
     * y que los meseros trabajando de madrugada sigan en el "día anterior".
     */
    async determineBusinessDate(tenantId: number, userId?: number): Promise<Date> {
        // Escenario 1: Hay contexto de usuario (mesero/cajero con posible turno abierto)
        if (userId) {
            const activeShift = await prisma.cashShift.findFirst({
                where: {
                    userId,
                    tenantId,
                    endTime: null
                }
            });

            if (activeShift) {
                // BIZ-011: Validar que la fecha del turno no esté obsoleta (> 2 días)
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
                    // Si la fecha está obsoleta, caer al fallback del reloj del sistema
                } else {
                    return activeShift.businessDate;
                }
            }
        }

        // Escenario 2: Sin turno activo u operación del sistema (webhook/admin)
        // FALLBACK: Usar reloj del sistema con la regla estándar de las 6 AM
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
