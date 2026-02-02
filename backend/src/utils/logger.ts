/**
 * @fileoverview Utilidad de logging estructurado con implementacion ligera.
 *
 * Produce logs en formato JSON para facilitar el procesamiento en entornos de produccion
 * (ej: ELK stack, CloudWatch, Datadog). Reemplaza las llamadas dispersas a console.log
 * con un sistema centralizado que soporta niveles, metadata y loggers hijos.
 *
 * @module utils/logger
 *
 * @remarks
 * Para produccion con alto volumen, considerar reemplazar por Pino para mejor rendimiento.
 * Instalacion: npm install pino
 */

/** Niveles de log soportados, de menor a mayor severidad */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Estructura de una entrada de log serializada a JSON */
interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    [key: string]: unknown;
}

/**
 * Logger estructurado para salida de logs consistente en formato JSON.
 * Reemplaza las llamadas desestructuradas a console.log en toda la aplicacion.
 *
 * Caracteristicas:
 * - Filtrado por nivel minimo configurable via variable de entorno LOG_LEVEL
 * - Metadata arbitraria adjunta a cada entrada (orderId, tenantId, etc.)
 * - Loggers hijos con contexto preestablecido (util para request IDs)
 *
 * @example
 * logger.info('Orden creada', { orderId: 123, total: 50.00 });
 * // Salida: {"timestamp":"2024-01-15T03:00:00.000Z","level":"info","message":"Orden creada","orderId":123,"total":50}
 *
 * logger.error('Fallo al procesar pago', { error: err.message, orderId: 123 });
 */
class Logger {
    /** Nivel minimo de log; los mensajes por debajo de este nivel se descartan */
    private readonly minLevel: LogLevel;

    /** Mapa de prioridad numerica por nivel para comparacion rapida */
    private readonly levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    constructor() {
        // Lee el nivel de log de la variable de entorno, con 'info' como valor por defecto
        const envLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
        this.minLevel = envLevel in this.levelPriority ? envLevel : 'info';
    }

    /**
     * Determina si un nivel de log debe emitirse segun el nivel minimo configurado.
     * Compara la prioridad numerica del nivel solicitado contra el minimo.
     */
    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }

    /**
     * Formatea y emite una entrada de log como JSON.
     * Agrega timestamp ISO 8601 automaticamente y fusiona la metadata adicional.
     * Dirige la salida al metodo de consola apropiado segun el nivel.
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

        // Usa el metodo de consola correspondiente para que los sistemas de captura
        // de logs (Docker, PM2, etc.) puedan diferenciar stderr de stdout
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
     * Registra un mensaje de nivel debug.
     * Solo se emite cuando LOG_LEVEL=debug. Util para trazas detalladas
     * durante desarrollo o diagnostico de problemas especificos.
     */
    debug(message: string, meta?: Record<string, unknown>): void {
        this.log('debug', message, meta);
    }

    /**
     * Registra un mensaje de nivel info.
     * Nivel por defecto para operaciones normales del negocio:
     * creacion de ordenes, inicio de turnos, login exitoso, etc.
     */
    info(message: string, meta?: Record<string, unknown>): void {
        this.log('info', message, meta);
    }

    /**
     * Registra un mensaje de nivel warning.
     * Para situaciones no criticas que requieren atencion:
     * stock bajo, metodo de pago desconocido, reintentos de conexion, etc.
     */
    warn(message: string, meta?: Record<string, unknown>): void {
        this.log('warn', message, meta);
    }

    /**
     * Registra un mensaje de nivel error.
     * Para errores que requieren atencion inmediata:
     * fallos de base de datos, errores de autenticacion, excepciones no controladas.
     */
    error(message: string, meta?: Record<string, unknown>): void {
        this.log('error', message, meta);
    }

    /**
     * Crea un logger hijo con metadata preestablecida.
     * Cada llamada al logger hijo incluye automaticamente esta metadata,
     * evitando repetirla en cada invocacion. Util para agregar requestId
     * o tenantId a todas las entradas de un flujo especifico.
     *
     * @example
     * const requestLogger = logger.child({ requestId: 'abc123' });
     * requestLogger.info('Procesando solicitud'); // incluye requestId en la salida
     */
    child(defaultMeta: Record<string, unknown>): ChildLogger {
        return new ChildLogger(this, defaultMeta);
    }
}

/**
 * Logger hijo que incluye metadata preestablecida en todas las llamadas.
 * Se crea mediante logger.child() y delega la emision real al logger padre,
 * fusionando la metadata por defecto con la metadata especifica de cada llamada.
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
 * Instancia singleton del logger para uso en toda la aplicacion.
 * Se importa como: `import { logger } from './utils/logger';`
 *
 * Al ser singleton, la configuracion de nivel se lee una sola vez al arrancar
 * y se mantiene consistente en todo el proceso.
 */
export const logger = new Logger();
