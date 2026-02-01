
import { Prisma } from '@prisma/client';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { logger } from '../utils/logger';

// Utility for strict timeouts
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Transaction client type definition
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Order Identifier
 */
export interface OrderIdentifier {
  id: string;           // UUID Primary Key
  orderNumber: number;  // Sequential Numeric ID (1, 2, 3...)
  formattedOrderNumber: string; // "YYYYMMDD-XXXX" (Optional Display)
  businessDate: Date;   // Business Date Used
}

export class OrderNumberService {
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 50;
  
  /**
   * Generates the next Order Number safely scoped to a Tenant and Business Day.
   * 
   * LOGIC:
   * 1. Relies on `tenantId` and `businessDate` passed from OrderService.
   * 2. Key Format: "TENANT_{id}_DATE_{YYYYMMDD}"
   * 3. Uses UPSERT atomic operation.
   * 
   * @param tx Prisma Transaction Client
   * @param tenantId Tenant ID
   * @param businessDate Business Date (from Shift or System)
   */
  async getNextOrderNumber(
    tx: TransactionClient, 
    tenantId: number, 
    businessDate: Date
  ): Promise<OrderIdentifier> {
    const startTime = Date.now();
    const operationId = uuidv4();
    const generatedUuid = uuidv4();

    // 1. Format Date for Key: YYYYMMDD
    const yyyy = businessDate.getFullYear();
    const mm = String(businessDate.getMonth() + 1).padStart(2, '0');
    const dd = String(businessDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // 2. Construct Sequence Key
    // FORMAT: TENANT_1_DATE_20260119
    const sequenceKey = `TENANT_${tenantId}_DATE_${dateStr}`;

    let currentOrderNumber = 0;
    let attempts = 0;
    let successful = false;

    // 3. Retry Loop
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

      } catch (error: any) {
        const isRetryable = error.code === 'P2034' || 
                           (error.message && error.message.includes('deadlock')) || 
                           (error.meta && error.meta.code === '40001');
        
        if (isRetryable || attempts < this.MAX_RETRIES) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempts - 1);
          logger.warn(`ORDER_SEQUENCE_RETRY`, {
             attempt: attempts,
             delayMs: delay,
             key: sequenceKey,
             error: error.message
          });
          await sleep(delay);
        } else {
          logger.error('ORDER_SEQUENCE_FATAL_FAILURE', {
            operationId,
            error: error.message,
            attempts
          });
          throw new Error(`CRITICAL: Failed to generate order number for Tenant ${tenantId} after ${attempts} attempts.`);
        }
      }
    }

    // 4. Format Display String
    const paddedNumber = String(currentOrderNumber).padStart(4, '0');
    const formattedOrderNumber = `${dateStr}-${paddedNumber}`;

    // 5. Audit
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

  validateUuid(uuid: string): boolean {
    return uuidValidate(uuid);
  }
}

export const orderNumberService = new OrderNumberService();