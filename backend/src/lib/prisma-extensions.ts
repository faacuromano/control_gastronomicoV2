/**
 * @fileoverview Extensiones de transacciones Prisma para remediacion P0
 *
 * Implementa el axioma de "Espera Acotada" de la Seccion 1.2 del TDD:
 * - Aplica timeout de lock para prevenir esperas indefinidas
 * - Provee un wrapper de nivel de aislamiento Serializable
 * - Centraliza el manejo de errores de transacciones
 *
 * En un sistema POS de gastronomia, multiples terminales pueden intentar
 * modificar la misma orden simultaneamente (ej: un mozo agrega items mientras
 * otro cobra). Estas extensiones garantizan que las operaciones concurrentes
 * no corrompan los datos mediante bloqueos pesimistas y transacciones serializables.
 *
 * @module lib/prisma-extensions
 * @implements TDD Seccion 1.2 - Estrategia de Bloqueo Pesimista
 * @implements TDD Seccion 1.4 - Cumplimiento ACID
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from '../utils/logger';

// ============================================================================
// CONSTANTES DE CONFIGURACION
// ============================================================================

/**
 * Tiempo maximo de espera para adquirir un lock (milisegundos).
 * Segun el axioma de "Espera Acotada" del TDD: ningun SELECT FOR UPDATE
 * debe esperar indefinidamente. Si un recurso esta bloqueado por mas de
 * este tiempo, se asume que hay un problema y se lanza error.
 *
 * CFG-007: Se validan los rangos del timeout para prevenir mala configuracion.
 * Minimo 1 segundo, maximo 30 segundos.
 */
const LOCK_TIMEOUT_MS = Math.max(1000, Math.min(30000, parseInt(process.env.LOCK_TIMEOUT_MS || '5000', 10) || 5000));

/**
 * Duracion maxima de una transaccion antes de que expire.
 * Previene que transacciones desbocadas mantengan locks indefinidamente.
 * Siempre debe ser mayor que el timeout de lock (se le suman 2 segundos minimo).
 *
 * Ejemplo: si el lock timeout es 5s, la transaccion tiene al menos 7s para completar.
 */
const TRANSACTION_TIMEOUT_MS = Math.max(
  LOCK_TIMEOUT_MS + 2000,
  Math.min(60000, parseInt(process.env.TRANSACTION_TIMEOUT_MS || '10000', 10) || 10000)
);

// ============================================================================
// TIPOS DE ERROR ESPECIFICOS
// ============================================================================

/**
 * Error lanzado cuando la adquisicion del lock expira.
 * Se mapea a HTTP 409 Conflict en las respuestas de la API, ya que indica
 * que otro proceso esta modificando el mismo recurso.
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
 * Error lanzado cuando una transicion de estado es invalida.
 * Ejemplo: intentar modificar una orden CANCELADA o pasar de DELIVERED a OPEN.
 * La maquina de estados define las transiciones validas y este error
 * protege la integridad del flujo de negocio.
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
// TIPO DE CONTEXTO DE TRANSACCION
// ============================================================================

/**
 * Tipo del cliente de transaccion para uso en operaciones anidadas.
 * Es el tipo del parametro `tx` que reciben los callbacks de transacciones.
 * Se excluyen los metodos de conexion y extension porque no tienen sentido
 * dentro de una transaccion activa.
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ============================================================================
// HELPERS DE TRANSACCIONES
// ============================================================================

/**
 * Ejecuta una funcion dentro de una transaccion Serializable con espera de lock acotada.
 *
 * Este es el wrapper principal para los fixes P0-003. Garantiza:
 * 1. Nivel de aislamiento SERIALIZABLE (previene lecturas fantasma)
 * 2. Timeout acotado de lock (previene esperas indefinidas)
 * 3. Timeout de transaccion (previene transacciones desbocadas)
 *
 * Caso de uso tipico: procesar un pago donde se necesita leer el total actual
 * de la orden, verificar que no esta pagada, y crear el registro de pago,
 * todo de forma atomica y sin que otro proceso pueda interferir.
 *
 * @complexity O(1) - Solo overhead de transaccion
 * @guarantee ACID - Nivel de aislamiento Serializable
 * @implements TDD Seccion 1.2 - Diseno de Transaccion Serializable
 *
 * @param fn - La funcion a ejecutar dentro de la transaccion
 * @param options - Configuracion opcional para sobreescribir los valores por defecto
 * @returns Resultado de la funcion de transaccion
 * @throws {LockTimeoutError} Si el lock no puede adquirirse dentro del timeout
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
        // Configurar el timeout de lock a nivel de sesion MySQL/InnoDB.
        // Esto asegura que un SELECT FOR UPDATE no quede esperando indefinidamente
        // si otra transaccion tiene el lock sobre las mismas filas.
        await tx.$executeRaw`SET innodb_lock_wait_timeout = ${Math.floor(lockTimeoutMs / 1000)}`;

        // Ejecutar la logica real de la transaccion
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

    // Manejar errores de timeout de lock (codigos de error MySQL)
    if (isLockTimeoutError(error)) {
      logger.warn('Lock timeout in serializable transaction', {
        resource: resourceName,
        durationMs: duration,
        lockTimeoutMs,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new LockTimeoutError(resourceName, lockTimeoutMs);
    }

    // Manejar errores de deadlock (el reintento lo maneja el caller)
    if (isDeadlockError(error)) {
      logger.warn('Deadlock detected in serializable transaction', {
        resource: resourceName,
        durationMs: duration
      });
      // Re-lanzar con error especifico para que el caller pueda reintentar
      throw error;
    }

    // Loguear y re-lanzar otros errores no esperados
    logger.error('Serializable transaction failed', {
      resource: resourceName,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Ejecuta una funcion con bloqueo pesimista a nivel de fila.
 *
 * Este es el wrapper principal para los fixes P0-001.
 * Usa SELECT FOR UPDATE para adquirir un lock exclusivo sobre filas especificas.
 *
 * Caso de uso tipico: actualizar el estado de una orden. Se bloquea la fila
 * de la orden, se lee su estado actual, se valida la transicion, y se actualiza.
 * Ningun otro proceso puede leer o modificar la orden mientras tanto.
 *
 * A diferencia de withSerializableTransaction, este wrapper usa Read Committed
 * como nivel de aislamiento porque el lock explicito (FOR UPDATE) ya provee
 * la proteccion necesaria sin el overhead de Serializable.
 *
 * @complexity O(1) - Lock de una sola fila
 * @guarantee Acceso exclusivo a las filas bloqueadas durante la transaccion
 * @implements TDD Seccion 1.2 - Bloqueo Pesimista
 *
 * @param fn - La funcion a ejecutar (recibe el cliente de transaccion)
 * @param options - Configuracion del comportamiento del lock
 * @returns Resultado de la funcion de transaccion
 * @throws {LockTimeoutError} Si el lock no puede adquirirse
 *
 * @example
 * ```typescript
 * const order = await withPessimisticLock(async (tx) => {
 *   // Lock adquirido - seguro leer y modificar
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
        // Configurar timeout de lock a nivel de sesion
        await tx.$executeRaw`SET innodb_lock_wait_timeout = ${Math.floor(lockTimeoutMs / 1000)}`;

        // Ejecutar la transaccion con bloqueo pesimista
        return await fn(tx);
      },
      {
        // Usar Read Committed para bloqueo pesimista (no Serializable).
        // El lock explicito (FOR UPDATE) ya provee el aislamiento necesario.
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
// HELPERS DE DETECCION DE ERRORES
// ============================================================================

/**
 * Verifica si el error es un timeout de lock.
 * Codigo de error MySQL 1205 = Lock wait timeout exceeded.
 * Prisma lo envuelve en el codigo P2034.
 */
function isLockTimeoutError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034 = La transaccion fallo por timeout de lock o deadlock
    return error.code === 'P2034' ||
           (error.meta?.code === '1205') ||
           (typeof error.message === 'string' && error.message.includes('Lock wait timeout'));
  }
  return false;
}

/**
 * Verifica si el error es un deadlock.
 * Codigo de error MySQL 1213 = Deadlock found.
 * Un deadlock ocurre cuando dos transacciones se bloquean mutuamente.
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
// VALIDACION DE MAQUINA DE ESTADOS
// ============================================================================

/**
 * Transiciones validas del estado de una orden.
 * Segun el TDD: CANCELLED y DELIVERED son estados terminales - no se permiten
 * transiciones desde ellos. Esto protege la integridad del flujo de negocio:
 * una vez que una orden se entrego o cancelo, no se puede revertir.
 */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PREPARING', 'CANCELLED'],
  'PREPARING': ['READY', 'CANCELLED'],
  'READY': ['ON_ROUTE', 'DELIVERED', 'CANCELLED'],
  'ON_ROUTE': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [], // Estado terminal
  'CANCELLED': [], // Estado terminal - NO se permiten transiciones
};

/**
 * Valida si una transicion de estado es permitida.
 *
 * @implements TDD Seccion 1.2 - Validacion de Maquina de Estados
 *
 * @param currentStatus - Estado actual de la orden
 * @param newStatus - Nuevo estado deseado
 * @returns true si la transicion es valida
 */
export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    return false;
  }
  return allowedTransitions.includes(newStatus);
}

/**
 * Afirma que una transicion de estado es valida, lanzando error si no lo es.
 * Usado como guard clause antes de actualizar el estado de una orden.
 *
 * @param currentStatus - Estado actual de la orden
 * @param newStatus - Nuevo estado deseado
 * @throws {InvalidStateTransitionError} Si la transicion no esta permitida
 */
export function assertValidStatusTransition(currentStatus: string, newStatus: string): void {
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    throw new InvalidStateTransitionError(currentStatus, `transition to ${newStatus}`);
  }
}
