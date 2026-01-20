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
    id: string;
    orderNumber: number;
    businessDate: Date;
}
/**
 * Error types for order number generation
 */
export declare class OrderNumberGenerationError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown> | undefined);
}
/**
 * Service for generating unique, sequential order identifiers
 * with mathematical guarantees of uniqueness and fiscal auditability
 */
export declare class OrderNumberService {
    /**
     * Maximum retry attempts for sequence generation
     * Rationale: 3 attempts with exponential backoff should handle transient deadlocks
     */
    private readonly MAX_RETRIES;
    /**
     * Base delay for retry exponential backoff (milliseconds)
     * Rationale: 50ms is enough to let conflicting transaction complete
     */
    private readonly RETRY_BASE_DELAY_MS;
    /**
     * Maximum acceptable order number per day
     * Rationale: 9999 orders/day is reasonable limit; exceeding indicates bug
     */
    private readonly MAX_ORDER_NUMBER;
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
    getNextOrderNumber(tx: TransactionClient): Promise<OrderIdentifier>;
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
    private generateAndValidateUuid;
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
    private getNextSequenceNumber;
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
    private isRetryableError;
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
    private logOrderIdGenerated;
    /**
     * Validates that a UUID string follows RFC4122 v4 format
     *
     * USAGE: For validating UUIDs of legacy orders during backfill
     *
     * @param uuid - UUID string to validate
     * @returns true if valid RFC4122 v4 UUID, false otherwise
     */
    validateUuid(uuid: string): boolean;
    /**
     * Generates a UUID without persisting (useful for testing or dry-run)
     *
     * @returns RFC4122 v4 UUID string
     */
    generateUuid(): string;
}
/**
 * Singleton instance of the service
 *
 * Rationale: Single instance ensures consistent configuration and easier testing
 *
 * USAGE: import { orderNumberService } from './orderNumber.service'
 */
export declare const orderNumberService: OrderNumberService;
export {};
//# sourceMappingURL=orderNumber.service.d.ts.map