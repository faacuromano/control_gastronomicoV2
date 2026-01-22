import { Prisma } from '@prisma/client';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { logger } from '../utils/logger';
import { getBusinessDate } from '../utils/businessDate';

// Utility for strict timeouts
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Transaction client type definition
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Order Identifier - Expanded to include formatted string
 */
export interface OrderIdentifier {
  id: string;           // UUID Primary Key
  orderNumber: number;  // Sequential Numeric ID (for DB)
  formattedOrderNumber: string; // Ordered String "YYYYMMDD-XXXX" (for Display)
  businessDate: Date;   // Business Date
}

export class OrderNumberService {
  // Configuración de reintentos
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 50;
  
  /**
   * Genera el siguiente Número de Orden de forma atómica y segura.
   * IMPLEMENTACIÓN MEJORADA: UPSERT + RETRY LOOP + EXPONENTIAL BACKOFF
   */
  async getNextOrderNumber(tx: TransactionClient): Promise<OrderIdentifier> {
    const startTime = Date.now();
    const operationId = uuidv4();
    const generatedUuid = uuidv4();

    // 1. Obtener fecha comercial (Business Date) - Fuente de verdad
    const businessDate = getBusinessDate();
    
    // 2. Construir llave de secuencia (YYYYMMDD)
    // Se usa la fecha actual real para el "día" de la secuencia para asegurar unicidad diaria
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    
    // Formato Key: "YYYYMMDDHH" (Hourly Sharding for high concurrency)
    const sequenceKey = `${year}${month}${day}${hour}`;

    let currentOrderNumber = 0;
    let attempts = 0;
    let successful = false;

    // 3. Retry Loop para manejar Row Locks / Deadlocks
    while (attempts < this.MAX_RETRIES && !successful) {
      attempts++;
      
      try {
        // ATOMIC OPERATION: UPSERT
        // MySQL ON DUPLICATE KEY UPDATE manejado por Prisma
        const sequence = await tx.orderSequence.upsert({
          where: {
            sequenceKey: sequenceKey
          },
          update: {
            currentValue: {
              increment: 1
            }
          },
          create: {
            sequenceKey: sequenceKey,
            currentValue: 1
          }
        });

        currentOrderNumber = sequence.currentValue;
        successful = true;

      } catch (error: any) {
        // Analizar si es un error de concurrencia recuperable
        const isDeadlock = error.code === 'P2034' || // Prisma Write Conflict
                           (error.message && error.message.includes('deadlock')) || // MySQL Deadlock
                           (error.meta && error.meta.code === '40001'); // SQLState Deadlock
        
        if (isDeadlock || attempts < this.MAX_RETRIES) {
          // Exponential Backoff: 50ms, 100ms, 200ms...
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempts - 1);
          logger.warn(`ORDER_SEQUENCE_RETRY`, {
             attempt: attempts,
             delayMs: delay,
             key: sequenceKey,
             error: error.message
          });
          await sleep(delay);
        } else {
          // Si fallaron todos los reintentos o es un error fatal
          logger.error('ORDER_SEQUENCE_FATAL_FAILURE', {
            operationId,
            error: error.message,
            attempts
          });
          throw new Error(`CRITICAL: Failed to generate atomic order number after ${attempts} attempts.`);
        }
      }
    }

    // 4. Formatear salida: "YYYYMMDD-XXXX"
    const paddedNumber = String(currentOrderNumber).padStart(4, '0');
    const formattedOrderNumber = `${sequenceKey}-${paddedNumber}`;

    // 5. Audit Log Minimalista
    logger.info('ORDER_ID_GENERATED_ATOMIC', {
      operationId,
      uuid: generatedUuid,
      sequenceKey,
      orderNumber: currentOrderNumber,
      formatted: formattedOrderNumber,
      latency: Date.now() - startTime
    });

    return {
      id: generatedUuid,
      orderNumber: currentOrderNumber,
      formattedOrderNumber,
      businessDate
    };
  }

  // Helper para validar UUIDs (Legacy support)
  validateUuid(uuid: string): boolean {
    return uuidValidate(uuid);
  }
}

export const orderNumberService = new OrderNumberService();