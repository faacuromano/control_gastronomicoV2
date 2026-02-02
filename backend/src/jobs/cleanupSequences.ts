/**
 * Trabajo de limpieza de secuencias de pedidos (OrderSequence)
 *
 * Elimina registros antiguos de la tabla OrderSequence que tengan mas de 90 dias
 * de antiguedad. Esto previene el crecimiento descontrolado de la tabla en entornos
 * multi-tenant, donde cada tenant genera secuencias diarias de numeracion de pedidos.
 *
 * Este job puede invocarse desde un trabajo repetible de BullMQ o desde un
 * planificador cron externo. Retorna la cantidad de registros eliminados para
 * permitir monitoreo y logging desde el proceso que lo invoque.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/** Dias de retencion antes de purgar secuencias obsoletas */
const RETENTION_DAYS = 90;

/**
 * Elimina todas las secuencias de pedido cuya ultima actualizacion sea anterior
 * a la fecha de corte (hoy menos RETENTION_DAYS). Utiliza deleteMany sin filtro
 * de tenantId porque la limpieza aplica globalmente a todos los tenants.
 *
 * @returns Cantidad de registros eliminados
 */
export async function cleanupOldSequences(): Promise<number> {
    // Calcula la fecha de corte restando los dias de retencion a la fecha actual
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    // Elimina en lote todas las secuencias cuya ultima actualizacion sea anterior al corte
    const deleted = await prisma.orderSequence.deleteMany({
        where: {
            updatedAt: { lt: cutoff },
        },
    });

    // Registra el resultado para auditoria y monitoreo operativo
    logger.info('OrderSequence cleanup completed', {
        deletedCount: deleted.count,
        cutoffDate: cutoff.toISOString(),
        retentionDays: RETENTION_DAYS,
    });

    return deleted.count;
}
