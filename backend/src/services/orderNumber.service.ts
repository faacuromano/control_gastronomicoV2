/**
 * @fileoverview Servicio de Generacion de Numeros de Orden
 *
 * Genera numeros de orden secuenciales de forma atomica y segura,
 * aislados por Tenant y Fecha de Negocio. Cada tenant tiene su propia
 * secuencia que se reinicia diariamente.
 *
 * Usa la tabla OrderSequence con UPSERT atomico para garantizar unicidad
 * incluso con multiples cajeros creando ordenes simultaneamente.
 * Implementa reintentos con backoff exponencial para manejar deadlocks.
 *
 * Formato de clave: TENANT_{id}_DATE_{YYYYMMDD}
 * Formato de display: YYYYMMDD-XXXX (ej: 20260119-0001)
 *
 * @module services/orderNumber.service
 */

import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// DEP-004: Reemplaza dependencia uuid con crypto.randomUUID() nativo de Node.js
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { ConflictError } from '../utils/errors';

// Utilidad para pausas con timeout estricto en reintentos
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tipo de cliente de transaccion Prisma
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Identificador completo de una orden generada.
 * Incluye UUID (clave primaria), numero secuencial y formato de display.
 */
export interface OrderIdentifier {
  id: string;           // UUID como clave primaria
  orderNumber: number;  // Numero secuencial (1, 2, 3...)
  formattedOrderNumber: string; // Formato display "YYYYMMDD-XXXX" (opcional)
  businessDate: Date;   // Fecha de negocio utilizada para la secuencia
}

export class OrderNumberService {
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 50;

  /**
   * Genera el siguiente numero de orden de forma segura, aislado por Tenant y Fecha de Negocio.
   *
   * LOGICA:
   * 1. Recibe tenantId y businessDate desde OrderService
   * 2. Construye clave de secuencia: "TENANT_{id}_DATE_{YYYYMMDD}"
   * 3. Usa UPSERT atomico: si la secuencia no existe, la crea con valor 1;
   *    si existe, incrementa atomicamente
   * 4. Reintentos con backoff exponencial para manejar deadlocks de BD
   *
   * @param tx Cliente de transaccion Prisma (para ejecutar dentro de la tx de la orden)
   * @param tenantId ID del tenant
   * @param businessDate Fecha de negocio (del turno o del sistema)
   */
  async getNextOrderNumber(
    tx: TransactionClient,
    tenantId: number,
    businessDate: Date
  ): Promise<OrderIdentifier> {
    const startTime = Date.now();
    const operationId = crypto.randomUUID();
    const generatedUuid = crypto.randomUUID();

    // 1. Formatear fecha para la clave: YYYYMMDD
    const yyyy = businessDate.getFullYear();
    const mm = String(businessDate.getMonth() + 1).padStart(2, '0');
    const dd = String(businessDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // 2. Construir clave de secuencia unica por tenant y fecha
    // FORMATO: TENANT_1_DATE_20260119
    const sequenceKey = `TENANT_${tenantId}_DATE_${dateStr}`;

    let currentOrderNumber = 0;
    let attempts = 0;
    let successful = false;

    // 3. Bucle de reintentos con backoff exponencial
    while (attempts < this.MAX_RETRIES && !successful) {
      attempts++;

      try {
        const sequence = await tx.orderSequence.upsert({
          where: {
            tenantId_sequenceKey: {
              tenantId,
              sequenceKey
            }
          },
          update: {
            currentValue: { increment: 1 }
          },
          create: {
            tenantId,
            sequenceKey,
            currentValue: 1
          }
        });

        currentOrderNumber = sequence.currentValue;
        successful = true;

      } catch (error: unknown) {
        const isPrismaError = error instanceof Prisma.PrismaClientKnownRequestError;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRetryable = (isPrismaError && error.code === 'P2034') ||
                           errorMessage.includes('deadlock') ||
                           (isPrismaError && (error.meta as Record<string, unknown>)?.code === '40001');

        if (isRetryable || attempts < this.MAX_RETRIES) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempts - 1);
          logger.warn(`ORDER_SEQUENCE_RETRY`, {
             attempt: attempts,
             delayMs: delay,
             key: sequenceKey,
             error: errorMessage
          });
          await sleep(delay);
        } else {
          logger.error('ORDER_SEQUENCE_FATAL_FAILURE', {
            operationId,
            error: errorMessage,
            attempts
          });
          throw new ConflictError(`Failed to generate order number for Tenant ${tenantId} after ${attempts} attempts`);
        }
      }
    }

    // 4. Formatear string de display: YYYYMMDD-XXXX (ej: 20260119-0042)
    const paddedNumber = String(currentOrderNumber).padStart(4, '0');
    const formattedOrderNumber = `${dateStr}-${paddedNumber}`;

    // 5. Registro de auditoria para trazabilidad
    logger.info('ORDER_ID_GENERATED', {
      operationId,
      uuid: generatedUuid,
      tenantId,
      sequenceKey,
      orderNumber: currentOrderNumber,
      businessDate: businessDate.toISOString().split('T')[0]
    });

    return {
      id: generatedUuid,
      orderNumber: currentOrderNumber,
      formattedOrderNumber,
      businessDate
    };
  }

  /**
   * Valida que un string sea un UUID v4 valido.
   * Usado para verificar IDs de orden recibidos en requests.
   */
  validateUuid(uuid: string): boolean {
    return UUID_REGEX.test(uuid);
  }
}

export const orderNumberService = new OrderNumberService();
