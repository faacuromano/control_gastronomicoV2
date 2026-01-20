/**
 * @fileoverview OrderNumber Service - Banking Grade Implementation with UUID Support
 *
 * MIGRACIÓN: Hybrid UUID + Display Number (Solution C)
 * COMPLIANCE: AFIP Resolución 4291/2018, SOC2 Type II
 * CRITICALITY: FINANCIAL DATA - Zero tolerance for duplicates or data loss
 *
 * GARANTÍAS MATEMÁTICAS:
 * 1. UUID v4 = Probabilidad de colisión < 10^-36 (prácticamente imposible)
 * 2. UNIQUE constraint (businessDate, orderNumber) = Garantía de DB
 * 3. SELECT FOR UPDATE = Serialización de secuencias por día
 *
 * AUDIT TRAIL:
 * - Cada generación de Order ID se loggea con timestamp, businessDate, y UUID
 * - Métricas de performance se envían a monitoring
 * - Errores de constraint se detectan y alertan inmediatamente
 */
import { Prisma } from '@prisma/client';
/**
 * Transaction context type para Prisma interactive transactions
 */
type TransactionClient = Prisma.TransactionClient;
/**
 * Resultado de la generación de Order ID
 *
 * @property id - UUID v4 (Primary Key técnico, globalmente único)
 * @property orderNumber - Número secuencial para display (1-9999, resetea diario)
 * @property businessDate - Fecha operativa (NO es calendar date, usa regla 6 AM)
 */
export interface OrderIdentifier {
    id: string;
    orderNumber: number;
    businessDate: Date;
}
/**
 * Service para generación de identificadores únicos de órdenes
 * con garantías matemáticas de unicidad y auditabilidad fiscal
 */
export declare class OrderNumberService {
    /**
     * Genera el próximo Order ID con garantías de unicidad y compliance fiscal.
     *
     * CRITICAL: Este método implementa el patrón "Dual-Write" durante la migración:
     * - Genera UUID (Primary Key futuro)
     * - Genera orderNumber secuencial (Display number)
     * - Calcula businessDate UNA VEZ (evita race condition del 6 AM cutoff)
     *
     * GARANTÍAS:
     * 1. UUID es globalmente único (no requiere coordinación entre servidores)
     * 2. orderNumber es único por businessDate (garantizado por DB constraint)
     * 3. businessDate es determinístico (calculado UNA sola vez)
     *
     * COMPLIANCE AFIP:
     * - OrderNumber es secuencial por día operativo (req. para facturación electrónica)
     * - BusinessDate permite agrupar ventas según reglas contables (cierre a las 6 AM)
     * - Audit trail completo en logs
     *
     * PERFORMANCE:
     * - SELECT FOR UPDATE serializa solo por businessDate (diferentes días = paralelo)
     * - UUID generation es O(1) y no requiere DB roundtrip
     * - Retry logic para manejar deadlocks (max 3 intentos)
     *
     * @param tx - Prisma transaction context (REQUIRED para atomicidad)
     * @returns OrderIdentifier con id (UUID), orderNumber, y businessDate
     *
     * @throws Error si no se puede generar order number después de 3 reintentos
     * @throws Error si UUID validation falla (indica bug crítico)
     *
     * @example
     * ```typescript
     * await prisma.$transaction(async (tx) => {
     *   const { id, orderNumber, businessDate } = await orderNumberService.getNextOrderNumber(tx);
     *
     *   const order = await tx.order.create({
     *     data: {
     *       id,              // ← UUID (PK técnico)
     *       orderNumber,     // ← Display number (#1, #2, #3...)
     *       businessDate,    // ← Fecha operativa (CRITICAL: usar el devuelto, NO recalcular)
     *       // ... resto de campos
     *     }
     *   });
     * });
     * ```
     */
    getNextOrderNumber(tx: TransactionClient): Promise<OrderIdentifier>;
    /**
     * Obtiene el próximo número de secuencia para un día operativo específico.
     *
     * IMPLEMENTACIÓN: SELECT FOR UPDATE para evitar race conditions
     * - FOR UPDATE adquiere lock exclusivo en la fila de OrderSequence
     * - Otras transacciones esperan hasta que esta commitee o rollback
     * - Solo serializa por sequenceKey (diferentes días = paralelo)
     *
     * RETRY LOGIC:
     * - Max 3 intentos con exponential backoff (50ms, 100ms, 150ms)
     * - Maneja deadlocks y lock wait timeouts
     * - Si 3 intentos fallan, lanza excepción (requiere investigación)
     *
     * @private
     * @param tx - Transaction context
     * @param sequenceKey - Formato "YYYYMMDD" (ej: "20260119")
     * @param businessDate - Business date para logging
     * @returns Order number secuencial (1-based)
     */
    private getNextSequenceNumber;
    /**
     * Valida que un UUID existente sigue el formato RFC4122 v4.
     *
     * USAGE: Para validar UUIDs de órdenes legacy durante backfill
     *
     * @param uuid - UUID string a validar
     * @returns true si es válido, false otherwise
     */
    validateUuid(uuid: string): boolean;
    /**
     * Genera un UUID sin persistir (útil para testing o dry-run)
     *
     * @returns UUID v4 string
     */
    generateUuid(): string;
}
/**
 * Singleton instance del service
 * USAGE: import { orderNumberService } from './orderNumber.service'
 */
export declare const orderNumberService: OrderNumberService;
export {};
//# sourceMappingURL=orderNumber.service.NEW.d.ts.map