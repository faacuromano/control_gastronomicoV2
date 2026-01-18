/**
 * @fileoverview Structured logging utility using a lightweight implementation.
 * Provides JSON-formatted logs for production environments.
 *
 * @module utils/logger
 * @remarks
 * For production, consider replacing with Pino for better performance.
 * Install: npm install pino
 */
/**
 * Structured logger for consistent, JSON-formatted log output.
 * Replaces unstructured console.log calls throughout the application.
 *
 * @example
 * logger.info('Order created', { orderId: 123, total: 50.00 });
 * // Output: {"timestamp":"2024-01-15T03:00:00.000Z","level":"info","message":"Order created","orderId":123,"total":50}
 *
 * logger.error('Failed to process payment', { error: err.message, orderId: 123 });
 */
declare class Logger {
    private readonly minLevel;
    private readonly levelPriority;
    constructor();
    /**
     * Check if a log level should be output based on minimum level.
     */
    private shouldLog;
    /**
     * Format and output a log entry.
     */
    private log;
    /**
     * Log debug-level message.
     * Only output when LOG_LEVEL=debug.
     */
    debug(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log info-level message.
     * Default log level for normal operations.
     */
    info(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log warning-level message.
     * For non-critical issues that should be addressed.
     */
    warn(message: string, meta?: Record<string, unknown>): void;
    /**
     * Log error-level message.
     * For errors that need immediate attention.
     */
    error(message: string, meta?: Record<string, unknown>): void;
    /**
     * Create a child logger with preset context.
     * Useful for adding request IDs or user context.
     *
     * @example
     * const requestLogger = logger.child({ requestId: 'abc123' });
     * requestLogger.info('Processing request'); // includes requestId in output
     */
    child(defaultMeta: Record<string, unknown>): ChildLogger;
}
/**
 * Child logger that includes preset metadata in all log calls.
 */
declare class ChildLogger {
    private parent;
    private defaultMeta;
    constructor(parent: Logger, defaultMeta: Record<string, unknown>);
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
/**
 * Singleton logger instance for application-wide use.
 * Import and use: `import { logger } from './utils/logger';`
 */
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map