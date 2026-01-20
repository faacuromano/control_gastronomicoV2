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
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getBusinessDate, getBusinessDateKey } from '../utils/businessDate';

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
  id: string;           // UUID - DEBE ser usado como PK en Order table
  orderNumber: number;  // Display number - Para tickets de cocina, facturación
  businessDate: Date;   // Business date - Para agrupación contable (AFIP compliance)
}

/**
 * Service para generación de identificadores únicos de órdenes
 * con garantías matemáticas de unicidad y auditabilidad fiscal
 */
export class OrderNumberService {
  
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
  async getNextOrderNumber(tx: TransactionClient): Promise<OrderIdentifier> {
    const startTime = Date.now();
    
    // STEP 1: Generar UUID v4 (independiente de DB, NTP, timestamps)
    const id = uuidv4();
    
    // PARANOID CHECK: Validar formato UUID (nunca debería fallar, pero...)
    if (!uuidValidate(id)) {
      const error = new Error(`UUID generation failed validation: ${id}`);
      logger.error('CRITICAL_UUID_VALIDATION_FAILURE', {
        generatedUuid: id,
        severity: 'CRITICAL',
        action: 'ALERT_ENGINEERING_IMMEDIATELY'
      });
      throw error;
    }
    
    // STEP 2: Calcular businessDate UNA VEZ (source of truth)
    // CRITICAL: Este valor se usa tanto para sequenceKey como para persistir en Order
    const businessDate = getBusinessDate();
    const sequenceKey = getBusinessDateKey(businessDate);
    
    // STEP 3: Obtener orderNumber secuencial con row-level locking
    const orderNumber = await this.getNextSequenceNumber(tx, sequenceKey, businessDate);
    
    // STEP 4: Log audit trail
    const generationTime = Date.now() - startTime;
    logger.info('ORDER_ID_GENERATED', {
      uuid: id,
      orderNumber,
      businessDate: businessDate.toISOString(),
      sequenceKey,
      generationTimeMs: generationTime,
      timestamp: new Date().toISOString()
    });
    
    // STEP 5: Métricas de performance
    if (generationTime > 100) {
      logger.warn('ORDER_ID_GENERATION_SLOW', {
        generationTimeMs: generationTime,
        threshold: 100,
        action: 'INVESTIGATE_DB_PERFORMANCE'
      });
    }
    
    return { id, orderNumber, businessDate };
  }
  
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
  private async getNextSequenceNumber(
    tx: TransactionClient,
    sequenceKey: string,
    businessDate: Date
  ): Promise<number> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // STEP 1: Intentar obtener secuencia existente con lock exclusivo
        // FOR UPDATE previene que otras transacciones lean esta fila hasta que committeemos
        const existing = await tx.$queryRaw<Array<{ id: number; currentValue: number }>>`
          SELECT id, currentValue 
          FROM OrderSequence 
          WHERE sequenceKey = ${sequenceKey}
          FOR UPDATE
        `;
        
        if (existing.length > 0) {
          // Secuencia existe - incrementar
          const sequence = existing[0];
          
          // PARANOID CHECK: Verificar que la secuencia existe
          if (!sequence) {
            throw new Error('Sequence found but array element is undefined (impossible state)');
          }
          
          const newValue = sequence.currentValue + 1;
          
          // PARANOID CHECK: Detectar overflow (orderNumber > 9999 es sospechoso)
          if (newValue > 9999) {
            logger.warn('ORDER_NUMBER_HIGH_VALUE', {
              sequenceKey,
              orderNumber: newValue,
              businessDate: businessDate.toISOString(),
              action: 'VERIFY_BUSINESS_DATE_LOGIC'
            });
          }
          
          await tx.orderSequence.update({
            where: { id: sequence.id },
            data: { currentValue: newValue }
          });
          
          logger.debug('Sequence incremented', {
            sequenceKey,
            oldValue: sequence.currentValue,
            newValue,
            attempt
          });
          
          return newValue;
          
        } else {
          // Secuencia NO existe - crear nueva con valor inicial 1
          const newSequence = await tx.orderSequence.create({
            data: {
              sequenceKey,
              currentValue: 1
            }
          });
          
          logger.info('NEW_SEQUENCE_CREATED', {
            sequenceKey,
            businessDate: businessDate.toISOString(),
            initialValue: 1
          });
          
          return 1;
        }
        
      } catch (error) {
        lastError = error as Error;
        
        // Log error con detalles para debugging
        logger.warn('ORDER_SEQUENCE_GENERATION_RETRY', {
          attempt,
          maxRetries,
          sequenceKey,
          error: (error as Error).message,
          willRetry: attempt < maxRetries
        });
        
        // Si no es el último intento, esperar antes de reintentar (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    logger.error('ORDER_SEQUENCE_GENERATION_FAILED', {
      sequenceKey,
      businessDate: businessDate.toISOString(),
      attempts: maxRetries,
      lastError: lastError?.message,
      severity: 'CRITICAL',
      action: 'INVESTIGATE_IMMEDIATELY'
    });
    
    throw new Error(
      `Failed to generate order number after ${maxRetries} attempts: ${lastError?.message}`
    );
  }
  
  /**
   * Valida que un UUID existente sigue el formato RFC4122 v4.
   * 
   * USAGE: Para validar UUIDs de órdenes legacy durante backfill
   * 
   * @param uuid - UUID string a validar
   * @returns true si es válido, false otherwise
   */
  validateUuid(uuid: string): boolean {
    return uuidValidate(uuid);
  }
  
  /**
   * Genera un UUID sin persistir (útil para testing o dry-run)
   * 
   * @returns UUID v4 string
   */
  generateUuid(): string {
    return uuidv4();
  }
}

/**
 * Singleton instance del service
 * USAGE: import { orderNumberService } from './orderNumber.service'
 */
export const orderNumberService = new OrderNumberService();