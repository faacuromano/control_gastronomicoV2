/**
 * @fileoverview Prisma Transaction Extensions for P0 Remediation
 * 
 * Implements the "Bounded Wait" axiom from TDD Section 1.2:
 * - Enforces lock timeout to prevent indefinite waits
 * - Provides Serializable isolation level wrapper
 * - Centralizes transaction error handling
 * 
 * @module lib/prisma-extensions
 * @implements TDD Section 1.2 - Pessimistic Locking Strategy
 * @implements TDD Section 1.4 - ACID Compliance
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Maximum time to wait for lock acquisition (milliseconds).
 * Per TDD "Bounded Wait" axiom: No SELECT FOR UPDATE shall wait indefinitely.
 * 
 * @constant
 */
const LOCK_TIMEOUT_MS = 5000;

/**
 * Maximum transaction duration before timeout.
 * Prevents runaway transactions from holding locks.
 * 
 * @constant
 */
const TRANSACTION_TIMEOUT_MS = 10000;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error thrown when lock acquisition times out.
 * Maps to HTTP 409 Conflict for API responses.
 */
export class LockTimeoutError extends Error {
  public readonly code = 'LOCK_TIMEOUT';
  public readonly statusCode = 409;

  constructor(resource: string, timeoutMs: number) {
    super(`Failed to acquire lock on ${resource} within ${timeoutMs}ms. Resource is busy.`);
    this.name = 'LockTimeoutError';
  }
}

/**
 * Error thrown when state machine transition is invalid.
 * E.g., attempting to modify a CANCELLED order.
 */
export class InvalidStateTransitionError extends Error {
  public readonly code = 'INVALID_STATE_TRANSITION';
  public readonly statusCode = 409;

  constructor(currentState: string, attemptedAction: string) {
    super(`Cannot perform "${attemptedAction}" on resource in "${currentState}" state.`);
    this.name = 'InvalidStateTransitionError';
  }
}

// ============================================================================
// TRANSACTION CONTEXT TYPE
// ============================================================================

/**
 * Transaction client type for use in nested operations.
 * This is the type of `tx` parameter in transaction callbacks.
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Execute a function within a Serializable transaction with bounded lock wait.
 * 
 * This is the primary transaction wrapper for P0-003 fixes.
 * It enforces:
 * 1. SERIALIZABLE isolation level (prevents phantom reads)
 * 2. Bounded lock timeout (prevents indefinite waits)
 * 3. Transaction timeout (prevents runaway transactions)
 * 
 * @complexity O(1) - Transaction overhead only
 * @guarantee ACID - Serializable isolation level
 * @implements TDD Section 1.2 - Serializable Transaction Design
 * 
 * @param fn - The function to execute within the transaction
 * @param options - Optional configuration overrides
 * @returns Result of the transaction function
 * @throws {LockTimeoutError} If lock cannot be acquired within timeout
 * 
 * @example
 * ```typescript
 * const result = await withSerializableTransaction(async (tx) => {
 *   await tx.payment.create({ data: paymentData });
 *   const total = await tx.payment.aggregate({ ... });
 *   return total;
 * });
 * ```
 */
export async function withSerializableTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options: {
    lockTimeoutMs?: number;
    transactionTimeoutMs?: number;
    resourceName?: string;
  } = {}
): Promise<T> {
  const {
    lockTimeoutMs = LOCK_TIMEOUT_MS,
    transactionTimeoutMs = TRANSACTION_TIMEOUT_MS,
    resourceName = 'unknown'
  } = options;

  const startTime = Date.now();
  
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Set session-level lock timeout (MySQL/InnoDB specific)
        // This ensures SELECT FOR UPDATE doesn't wait indefinitely
        await tx.$executeRaw`SET innodb_lock_wait_timeout = ${Math.floor(lockTimeoutMs / 1000)}`;
        
        // Execute the actual transaction logic
        return await fn(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: transactionTimeoutMs,
      }
    );

    const duration = Date.now() - startTime;
    logger.debug('Serializable transaction completed', {
      resource: resourceName,
      durationMs: duration,
      isolationLevel: 'Serializable'
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Handle lock timeout errors (MySQL error codes)
    if (isLockTimeoutError(error)) {
      logger.warn('Lock timeout in serializable transaction', {
        resource: resourceName,
        durationMs: duration,
        lockTimeoutMs,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new LockTimeoutError(resourceName, lockTimeoutMs);
    }

    // Handle deadlock errors (retry at caller level)
    if (isDeadlockError(error)) {
      logger.warn('Deadlock detected in serializable transaction', {
        resource: resourceName,
        durationMs: duration
      });
      // Re-throw with specific error for caller retry logic
      throw error;
    }

    // Log and re-throw other errors
    logger.error('Serializable transaction failed', {
      resource: resourceName,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Execute a function with pessimistic row-level locking.
 * 
 * This is the primary wrapper for P0-001 fixes.
 * Uses SELECT FOR UPDATE to acquire exclusive lock on specific rows.
 * 
 * @complexity O(1) - Single row lock
 * @guarantee Exclusive access to locked rows during transaction
 * @implements TDD Section 1.2 - Pessimistic Locking
 * 
 * @param fn - The function to execute (receives transaction client)
 * @param options - Configuration for lock behavior
 * @returns Result of the transaction function
 * @throws {LockTimeoutError} If lock cannot be acquired
 * 
 * @example
 * ```typescript
 * const order = await withPessimisticLock(async (tx) => {
 *   // Lock acquired - safe to read and modify
 *   const order = await tx.$queryRaw`
 *     SELECT * FROM Order WHERE id = ${orderId} FOR UPDATE
 *   `;
 *   await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
 *   return order;
 * }, { resourceName: 'Order', lockTimeoutMs: 3000 });
 * ```
 */
export async function withPessimisticLock<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options: {
    lockTimeoutMs?: number;
    transactionTimeoutMs?: number;
    resourceName?: string;
  } = {}
): Promise<T> {
  const {
    lockTimeoutMs = LOCK_TIMEOUT_MS,
    transactionTimeoutMs = TRANSACTION_TIMEOUT_MS,
    resourceName = 'unknown'
  } = options;

  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Set session-level lock timeout
        await tx.$executeRaw`SET innodb_lock_wait_timeout = ${Math.floor(lockTimeoutMs / 1000)}`;
        
        // Execute the transaction with pessimistic locking
        return await fn(tx);
      },
      {
        // Use Read Committed for pessimistic locking (not Serializable)
        // The lock itself provides the isolation
        timeout: transactionTimeoutMs,
      }
    );

    const duration = Date.now() - startTime;
    logger.debug('Pessimistic lock transaction completed', {
      resource: resourceName,
      durationMs: duration
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (isLockTimeoutError(error)) {
      logger.warn('Lock timeout in pessimistic transaction', {
        resource: resourceName,
        durationMs: duration,
        lockTimeoutMs
      });
      throw new LockTimeoutError(resourceName, lockTimeoutMs);
    }

    logger.error('Pessimistic lock transaction failed', {
      resource: resourceName,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// ============================================================================
// ERROR DETECTION HELPERS
// ============================================================================

/**
 * Check if error is a lock timeout error.
 * MySQL error code 1205 = Lock wait timeout exceeded.
 */
function isLockTimeoutError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034 = Transaction failed due to lock timeout or deadlock
    return error.code === 'P2034' || 
           (error.meta?.code === '1205') ||
           (typeof error.message === 'string' && error.message.includes('Lock wait timeout'));
  }
  return false;
}

/**
 * Check if error is a deadlock error.
 * MySQL error code 1213 = Deadlock found.
 */
function isDeadlockError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034' && 
           (error.meta?.code === '1213' ||
            (typeof error.message === 'string' && error.message.includes('Deadlock')));
  }
  return false;
}

// ============================================================================
// STATE MACHINE VALIDATION
// ============================================================================

/**
 * Valid order status transitions.
 * Per TDD: CANCELLED is a terminal state - no transitions allowed.
 */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PREPARING', 'CANCELLED'],
  'PREPARING': ['READY', 'CANCELLED'],
  'READY': ['ON_ROUTE', 'DELIVERED', 'CANCELLED'],
  'ON_ROUTE': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [], // Terminal state
  'CANCELLED': [], // Terminal state - NO transitions allowed
};

/**
 * Validate if a status transition is allowed.
 * 
 * @implements TDD Section 1.2 - State Machine Validation
 * 
 * @param currentStatus - Current order status
 * @param newStatus - Desired new status
 * @returns true if transition is valid
 */
export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    return false;
  }
  return allowedTransitions.includes(newStatus);
}

/**
 * Assert that a status transition is valid, throwing if not.
 * 
 * @param currentStatus - Current order status
 * @param newStatus - Desired new status
 * @throws {InvalidStateTransitionError} If transition is not allowed
 */
export function assertValidStatusTransition(currentStatus: string, newStatus: string): void {
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    throw new InvalidStateTransitionError(currentStatus, `transition to ${newStatus}`);
  }
}
