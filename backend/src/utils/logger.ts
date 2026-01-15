/**
 * @fileoverview Structured logging utility using a lightweight implementation.
 * Provides JSON-formatted logs for production environments.
 * 
 * @module utils/logger
 * @remarks
 * For production, consider replacing with Pino for better performance.
 * Install: npm install pino
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    [key: string]: unknown;
}

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
class Logger {
    private readonly minLevel: LogLevel;
    private readonly levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    constructor() {
        const envLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
        this.minLevel = envLevel in this.levelPriority ? envLevel : 'info';
    }

    /**
     * Check if a log level should be output based on minimum level.
     */
    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }

    /**
     * Format and output a log entry.
     */
    private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta
        };

        const output = JSON.stringify(entry);

        switch (level) {
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    /**
     * Log debug-level message.
     * Only output when LOG_LEVEL=debug.
     */
    debug(message: string, meta?: Record<string, unknown>): void {
        this.log('debug', message, meta);
    }

    /**
     * Log info-level message.
     * Default log level for normal operations.
     */
    info(message: string, meta?: Record<string, unknown>): void {
        this.log('info', message, meta);
    }

    /**
     * Log warning-level message.
     * For non-critical issues that should be addressed.
     */
    warn(message: string, meta?: Record<string, unknown>): void {
        this.log('warn', message, meta);
    }

    /**
     * Log error-level message.
     * For errors that need immediate attention.
     */
    error(message: string, meta?: Record<string, unknown>): void {
        this.log('error', message, meta);
    }

    /**
     * Create a child logger with preset context.
     * Useful for adding request IDs or user context.
     * 
     * @example
     * const requestLogger = logger.child({ requestId: 'abc123' });
     * requestLogger.info('Processing request'); // includes requestId in output
     */
    child(defaultMeta: Record<string, unknown>): ChildLogger {
        return new ChildLogger(this, defaultMeta);
    }
}

/**
 * Child logger that includes preset metadata in all log calls.
 */
class ChildLogger {
    constructor(
        private parent: Logger,
        private defaultMeta: Record<string, unknown>
    ) {}

    debug(message: string, meta?: Record<string, unknown>): void {
        this.parent.debug(message, { ...this.defaultMeta, ...meta });
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.parent.info(message, { ...this.defaultMeta, ...meta });
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.parent.warn(message, { ...this.defaultMeta, ...meta });
    }

    error(message: string, meta?: Record<string, unknown>): void {
        this.parent.error(message, { ...this.defaultMeta, ...meta });
    }
}

/**
 * Singleton logger instance for application-wide use.
 * Import and use: `import { logger } from './utils/logger';`
 */
export const logger = new Logger();
