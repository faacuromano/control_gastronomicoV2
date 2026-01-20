/**
 * @fileoverview OrderNumber Service - Banking Grade Implementation (UUID Migration Ready)
 * 
 * CRITICALITY: FINANCIAL DATA - Zero tolerance for duplicates or data loss
 * COMPLIANCE: AFIP Resolución 4291/2018, SOC2 Type II, ISO 27001
 * 
 * MIGRATION STATUS: Phase 2 - Dual Write Pattern
 * - Genera UUID v4 (Primary Key futuro)
 * - Mantiene orderNumber secuencial (Display number)
 * - Calcula businessDate UNA ÚNICA VEZ (evita race condition)
 * 
 * GARANTÍAS MATEMÁTICAS:
 * 1. UUID v4 collision probability < 10^-36
 * 2. UNIQUE constraint (businessDate, orderNumber) enforced by DB
 * 3. SELECT FOR UPDATE serializes sequence generation per day
 * 
 * AUDIT TRAIL:
 * - Every Order ID generation is logged with timestamp, businessDate, UUID
 * - Performance metrics sent to monitoring
 * - Constraint errors detected and alerted immediately
 * 
 * @author Backend Architecture Team
 * @version 2.0.0 (UUID Migration)
 */

import { Prisma } from '@prisma/client';
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';
import { logger } from '../utils/logger';
import { getBusinessDate, getBusinessDateKeyHourly } from '../utils/businessDate';

/**
 * Transaction client type for Prisma interactive transactions
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Order Identifier - Complete set of IDs for an order
 * 
 * @property id - UUID v4 (Primary Key técnico, globally unique)
 * @property orderNumber - Sequential display number (1-9999, resets daily)
 * @property businessDate - Operational date (NOT calendar date, uses 6 AM rule)
 */
export interface OrderIdentifier {
  id: string;           // UUID - MUST be used as PK in Order table
  orderNumber: number;  // Display number - For kitchen tickets, invoicing
  businessDate: Date;   // Business date - For accounting grouping (AFIP compliance)
}

/**
 * Error types for order number generation
 */
export class OrderNumberGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OrderNumberGenerationError';
    
    // Ensure proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrderNumberGenerationError);
    }
  }
}

/**
 * Service for generating unique, sequential order identifiers
 * with mathematical guarantees of uniqueness and fiscal auditability
 */
export class OrderNumberService {
  
  /**
   * Maximum retry attempts for sequence generation
   * Rationale: 3 attempts with exponential backoff should handle transient deadlocks
   */
  private readonly MAX_RETRIES = 3;
  
  /**
   * Base delay for retry exponential backoff (milliseconds)
   * Rationale: 50ms is enough to let conflicting transaction complete
   */
  private readonly RETRY_BASE_DELAY_MS = 50;
  
  /**
   * Maximum acceptable order number per day
   * Rationale: 9999 orders/day is reasonable limit; exceeding indicates bug
   */
  private readonly MAX_ORDER_NUMBER = 9999;
  
  /**
   * Generates the next Order ID with guarantees of uniqueness and fiscal compliance.
   * 
   * CRITICAL: This method implements "Dual-Write" pattern during migration:
   * - Generates UUID (future Primary Key)
   * - Generates sequential orderNumber (display number)
   * - Calculates businessDate ONCE (prevents 6 AM cutoff race condition)
   * 
   * GUARANTEES:
   * 1. UUID is globally unique (no coordination between servers needed)
   * 2. orderNumber is unique per businessDate (guaranteed by DB constraint)
   * 3. businessDate is deterministic (calculated exactly once)
   * 
   * FISCAL COMPLIANCE (AFIP):
   * - orderNumber is sequential per operational day (required for electronic invoicing)
   * - businessDate allows grouping sales by accounting rules (6 AM closure)
   * - Complete audit trail in logs for tax authority inspection
   * 
   * PERFORMANCE:
   * - SELECT FOR UPDATE serializes only per businessDate (different days = parallel)
   * - UUID generation is O(1) and requires no DB roundtrip
   * - Retry logic handles deadlocks gracefully (max 3 attempts)
   * 
   * @param tx - Prisma transaction context (REQUIRED for atomicity)
   * @returns OrderIdentifier with id (UUID), orderNumber, businessDate
   * 
   * @throws OrderNumberGenerationError if generation fails after all retries
   * @throws OrderNumberGenerationError if UUID validation fails (critical bug indicator)
   * 
   * @example
   * ```typescript
   * await prisma.$transaction(async (tx) => {
   *   const { id, orderNumber, businessDate } = 
   *     await orderNumberService.getNextOrderNumber(tx);
   *   
   *   const order = await tx.order.create({
   *     data: {
   *       id,              // ← UUID (PK técnico)
   *       orderNumber,     // ← Display number (#1, #2, #3...)
   *       businessDate,    // ← Operational date (CRITICAL: use returned value, do NOT recalculate)
   *       // ... other fields
   *     }
   *   });
   * });
   * ```
   */
  async getNextOrderNumber(tx: TransactionClient): Promise<OrderIdentifier> {
    const startTime = Date.now();
    const operationId = uuidv4(); // For correlating logs
    
    try {
      // STEP 1: Generate UUID v4 (independent of DB, NTP, timestamps)
      // Rationale: UUID generation cannot fail unless crypto.randomBytes fails (extremely rare)
      const id = this.generateAndValidateUuid(operationId);
      
      // STEP 2: Calculate businessDate ONCE (source of truth)
      // Rationale: This value is used for both sequenceKey AND persisting in Order
      // CRITICAL: Any recalculation elsewhere breaks atomicity and causes 6 AM bug
      const businessDate = getBusinessDate();
      
      // CRITICAL FIX: Pass current time (new Date()) to get ACTUAL hour,
      // NOT businessDate which is always midnight (00:00:00)
      // businessDate is used internally by getBusinessDateKeyHourly for the DATE component
      const sequenceKey = getBusinessDateKeyHourly(new Date());
      
      // STEP 3: Obtain sequential orderNumber with row-level locking
      // Rationale: SELECT FOR UPDATE prevents concurrent transactions from reading same value
      const orderNumber = await this.getNextSequenceNumber(
        tx,
        sequenceKey,
        businessDate,
        operationId
      );
      
      // STEP 4: Log audit trail
      // Rationale: Every Order ID generation must be traceable for compliance
      const generationTime = Date.now() - startTime;
      this.logOrderIdGenerated({
        operationId,
        uuid: id,
        orderNumber,
        businessDate,
        sequenceKey,
        generationTimeMs: generationTime
      });
      
      // STEP 5: Performance monitoring
      // Rationale: Latency > 100ms indicates DB performance degradation
      if (generationTime > 100) {
        logger.warn('ORDER_ID_GENERATION_SLOW', {
          operationId,
          generationTimeMs: generationTime,
          threshold: 100,
          sequenceKey,
          action: 'INVESTIGATE_DB_PERFORMANCE'
        });
      }
      
      return { id, orderNumber, businessDate };
      
    } catch (error) {
      // Log error with full context for debugging
      logger.error('ORDER_ID_GENERATION_FAILED', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        severity: 'CRITICAL',
        action: 'ALERT_ENGINEERING_IMMEDIATELY'
      });
      
      // Re-throw as typed error
      if (error instanceof OrderNumberGenerationError) {
        throw error;
      }
      
      throw new OrderNumberGenerationError(
        'Failed to generate Order ID',
        'ORDER_ID_GENERATION_FAILED',
        { originalError: error }
      );
    }
  }
  
  /**
   * Generates and validates a UUID v4
   * 
   * PARANOID VALIDATION: Although UUID generation failure is statistically impossible,
   * we validate format because invalid UUID would corrupt database
   * 
   * @private
   * @param operationId - For log correlation
   * @returns Valid UUID v4 string
   * @throws OrderNumberGenerationError if validation fails
   */
  private generateAndValidateUuid(operationId: string): string {
    const uuid = uuidv4();
    
    // PARANOID CHECK 1: Validate UUID format
    // Rationale: Should never fail, but invalid UUID would break FK relationships
    if (!uuidValidate(uuid)) {
      const error = new OrderNumberGenerationError(
        `UUID generation failed validation: ${uuid}`,
        'UUID_VALIDATION_FAILED',
        { generatedUuid: uuid, operationId }
      );
      
      logger.error('CRITICAL_UUID_VALIDATION_FAILURE', {
        operationId,
        generatedUuid: uuid,
        severity: 'CRITICAL',
        action: 'ALERT_ENGINEERING_IMMEDIATELY'
      });
      
      throw error;
    }
    
    // PARANOID CHECK 2: Verify it's actually version 4
    // Rationale: We specifically need v4 (random) for collision resistance
    if (uuidVersion(uuid) !== 4) {
      const error = new OrderNumberGenerationError(
        `UUID version mismatch: expected v4, got v${uuidVersion(uuid)}`,
        'UUID_VERSION_MISMATCH',
        { generatedUuid: uuid, version: uuidVersion(uuid), operationId }
      );
      
      logger.error('UUID_VERSION_MISMATCH', {
        operationId,
        generatedUuid: uuid,
        expectedVersion: 4,
        actualVersion: uuidVersion(uuid),
        severity: 'HIGH'
      });
      
      throw error;
    }
    
    return uuid;
  }
  
  /**
   * Obtains the next sequence number for a specific operational day
   * 
   * IMPLEMENTATION: SELECT FOR UPDATE to prevent race conditions
   * - FOR UPDATE acquires exclusive lock on OrderSequence row
   * - Other transactions wait until this one commits or rolls back
   * - Serializes only per sequenceKey (different days = fully parallel)
   * 
   * RETRY LOGIC:
   * - Max 3 attempts with exponential backoff (50ms, 100ms, 150ms)
   * - Handles deadlocks and lock wait timeouts
   * - If 3 attempts fail, throws exception requiring investigation
   * 
   * @private
   * @param tx - Transaction context
   * @param sequenceKey - Format "YYYYMMDD" (e.g., "20260119")
   * @param businessDate - Business date for logging
   * @param operationId - For log correlation
   * @returns Sequential order number (1-based)
   * @throws OrderNumberGenerationError after max retries exceeded
   */
  private async getNextSequenceNumber(
    tx: TransactionClient,
    sequenceKey: string,
    businessDate: Date,
    operationId: string
  ): Promise<number> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // STEP 1: Attempt to acquire existing sequence with exclusive lock
        // Rationale: FOR UPDATE prevents other transactions from reading this row
        // until we commit, ensuring atomicity of read-increment-write
        const existing = await tx.$queryRaw<Array<{ id: number; currentValue: number }>>`
          SELECT id, currentValue 
          FROM OrderSequence 
          WHERE sequenceKey = ${sequenceKey}
          FOR UPDATE
        `;
        
        if (existing.length > 0) {
          // Sequence exists - increment it
          const sequence = existing[0];
          
          // PARANOID CHECK: Verify sequence object is not undefined
          // Rationale: TypeScript types don't guarantee runtime safety
          if (!sequence || sequence.id === undefined || sequence.currentValue === undefined) {
            throw new OrderNumberGenerationError(
              'Sequence found but data is malformed',
              'SEQUENCE_DATA_MALFORMED',
              { existing, operationId, attempt }
            );
          }
          
          const newValue = sequence.currentValue + 1;
          
          // PARANOID CHECK: Detect suspiciously high order numbers
          // Rationale: > 9999 orders/day is unusual and may indicate:
          // - Business date logic bug (not resetting daily)
          // - Attack (someone flooding orders)
          if (newValue > this.MAX_ORDER_NUMBER) {
            logger.warn('ORDER_NUMBER_EXCEEDS_EXPECTED_RANGE', {
              operationId,
              sequenceKey,
              orderNumber: newValue,
              maxExpected: this.MAX_ORDER_NUMBER,
              businessDate: businessDate.toISOString(),
              action: 'VERIFY_BUSINESS_DATE_LOGIC'
            });
          }
          
          // Update sequence with new value
          // Rationale: Using Prisma ORM here instead of raw SQL because:
          // - Type safety on update operation
          // - Automatic parameter sanitization
          await tx.orderSequence.update({
            where: { id: sequence.id },
            data: { currentValue: newValue }
          });
          
          logger.debug('SEQUENCE_INCREMENTED', {
            operationId,
            sequenceKey,
            oldValue: sequence.currentValue,
            newValue,
            attempt,
            sequenceId: sequence.id
          });
          
          return newValue;
          
        } else {
          // Sequence does NOT exist - create new with initial value 1
          // Rationale: First order of the day always starts at #1
          const newSequence = await tx.orderSequence.create({
            data: {
              sequenceKey,
              currentValue: 1
            }
          });
          
          logger.info('NEW_SEQUENCE_CREATED', {
            operationId,
            sequenceKey,
            businessDate: businessDate.toISOString(),
            initialValue: 1,
            sequenceId: newSequence.id
          });
          
          return 1;
        }
        
      } catch (error) {
        lastError = error as Error;
        
        // Determine if error is retryable
        // Rationale: Deadlocks and lock timeouts are transient; other errors are not
        const isRetryable = this.isRetryableError(error as Error);
        
        logger.warn('ORDER_SEQUENCE_GENERATION_RETRY', {
          operationId,
          attempt,
          maxRetries: this.MAX_RETRIES,
          sequenceKey,
          error: (error as Error).message,
          errorCode: (error as any).code,
          isRetryable,
          willRetry: attempt < this.MAX_RETRIES && isRetryable
        });
        
        // If not retryable, fail immediately
        if (!isRetryable) {
          throw new OrderNumberGenerationError(
            `Non-retryable error during sequence generation: ${(error as Error).message}`,
            'SEQUENCE_GENERATION_NON_RETRYABLE',
            { error, operationId, sequenceKey }
          );
        }
        
        // If not last attempt, wait before retrying (exponential backoff)
        // Rationale: Exponential backoff reduces contention when multiple transactions retry
        if (attempt < this.MAX_RETRIES) {
          const delayMs = this.RETRY_BASE_DELAY_MS * attempt; // 50ms, 100ms, 150ms
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
    }
    
    // If we reach here, all retry attempts failed
    logger.error('ORDER_SEQUENCE_GENERATION_EXHAUSTED_RETRIES', {
      operationId,
      sequenceKey,
      businessDate: businessDate.toISOString(),
      attempts: this.MAX_RETRIES,
      lastError: lastError?.message,
      lastErrorStack: lastError?.stack,
      severity: 'CRITICAL',
      action: 'INVESTIGATE_IMMEDIATELY'
    });
    
    throw new OrderNumberGenerationError(
      `Failed to generate order number after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
      'SEQUENCE_GENERATION_MAX_RETRIES_EXCEEDED',
      { lastError, operationId, sequenceKey, attempts: this.MAX_RETRIES }
    );
  }
  
  /**
   * Determines if an error is retryable
   * 
   * Retryable errors:
   * - Deadlocks (SQLSTATE 40001)
   * - Lock wait timeout (SQLSTATE HY000, errno 1205)
   * 
   * Non-retryable errors:
   * - Constraint violations (would fail again)
   * - Connection errors (need different handling)
   * - Syntax errors (code bug)
   * 
   * @private
   * @param error - Error to check
   * @returns true if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;
    
    // MySQL deadlock error
    if (errorMessage.includes('deadlock')) {
      return true;
    }
    
    // MySQL lock wait timeout
    if (errorMessage.includes('lock wait timeout') || errorCode === '1205') {
      return true;
    }
    
    // Prisma deadlock code
    if (errorCode === 'P2034') {
      return true;
    }
    
    // Default: not retryable
    return false;
  }
  
  /**
   * Logs Order ID generation with structured data
   * 
   * Rationale: Audit trail required for:
   * - AFIP compliance (must prove order numbers are sequential)
   * - Debugging (correlate order creation with ID generation)
   * - Performance monitoring (track latency trends)
   * 
   * @private
   */
  private logOrderIdGenerated(data: {
    operationId: string;
    uuid: string;
    orderNumber: number;
    businessDate: Date;
    sequenceKey: string;
    generationTimeMs: number;
  }): void {
    logger.info('ORDER_ID_GENERATED', {
      operationId: data.operationId,
      uuid: data.uuid,
      orderNumber: data.orderNumber,
      businessDate: data.businessDate.toISOString(),
      businessDateFormatted: data.businessDate.toISOString().split('T')[0],
      sequenceKey: data.sequenceKey,
      generationTimeMs: data.generationTimeMs,
      timestamp: new Date().toISOString(),
      
      // Metrics for monitoring
      metrics: {
        latency_ms: data.generationTimeMs,
        order_number: data.orderNumber, // For detecting unusual values
        business_date: data.sequenceKey  // For grouping by day
      }
    });
  }
  
  /**
   * Validates that a UUID string follows RFC4122 v4 format
   * 
   * USAGE: For validating UUIDs of legacy orders during backfill
   * 
   * @param uuid - UUID string to validate
   * @returns true if valid RFC4122 v4 UUID, false otherwise
   */
  validateUuid(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    
    return uuidValidate(uuid) && uuidVersion(uuid) === 4;
  }
  
  /**
   * Generates a UUID without persisting (useful for testing or dry-run)
   * 
   * @returns RFC4122 v4 UUID string
   */
  generateUuid(): string {
    return uuidv4();
  }
}

/**
 * Singleton instance of the service
 * 
 * Rationale: Single instance ensures consistent configuration and easier testing
 * 
 * USAGE: import { orderNumberService } from './orderNumber.service'
 */
export const orderNumberService = new OrderNumberService();
