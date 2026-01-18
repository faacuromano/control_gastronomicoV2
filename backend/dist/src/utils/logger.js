"use strict";
/**
 * @fileoverview Structured logging utility using a lightweight implementation.
 * Provides JSON-formatted logs for production environments.
 *
 * @module utils/logger
 * @remarks
 * For production, consider replacing with Pino for better performance.
 * Install: npm install pino
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
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
    minLevel;
    levelPriority = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };
    constructor() {
        const envLevel = (process.env.LOG_LEVEL || 'info');
        this.minLevel = envLevel in this.levelPriority ? envLevel : 'info';
    }
    /**
     * Check if a log level should be output based on minimum level.
     */
    shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }
    /**
     * Format and output a log entry.
     */
    log(level, message, meta) {
        if (!this.shouldLog(level))
            return;
        const entry = {
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
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    /**
     * Log info-level message.
     * Default log level for normal operations.
     */
    info(message, meta) {
        this.log('info', message, meta);
    }
    /**
     * Log warning-level message.
     * For non-critical issues that should be addressed.
     */
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    /**
     * Log error-level message.
     * For errors that need immediate attention.
     */
    error(message, meta) {
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
    child(defaultMeta) {
        return new ChildLogger(this, defaultMeta);
    }
}
/**
 * Child logger that includes preset metadata in all log calls.
 */
class ChildLogger {
    parent;
    defaultMeta;
    constructor(parent, defaultMeta) {
        this.parent = parent;
        this.defaultMeta = defaultMeta;
    }
    debug(message, meta) {
        this.parent.debug(message, { ...this.defaultMeta, ...meta });
    }
    info(message, meta) {
        this.parent.info(message, { ...this.defaultMeta, ...meta });
    }
    warn(message, meta) {
        this.parent.warn(message, { ...this.defaultMeta, ...meta });
    }
    error(message, meta) {
        this.parent.error(message, { ...this.defaultMeta, ...meta });
    }
}
/**
 * Singleton logger instance for application-wide use.
 * Import and use: `import { logger } from './utils/logger';`
 */
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map