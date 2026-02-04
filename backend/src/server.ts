/**
 * @fileoverview Punto de entrada del servidor HTTP
 *
 * Este archivo crea el servidor HTTP, inicializa Socket.IO para comunicacion
 * en tiempo real (KDS, actualizacion de mesas) y opcionalmente arranca el
 * procesador de webhooks BullMQ si Redis esta disponible.
 *
 * Tambien implementa el apagado graceful (graceful shutdown) que asegura que
 * las conexiones abiertas se cierren correctamente antes de terminar el proceso,
 * evitando perdida de datos en jobs en progreso.
 *
 * @module server
 */

// FIX-005 (SEC-006): dotenv.config() DEBE ejecutarse antes de cualquier import
// que lea process.env. Los imports de ES modules se ejecutan en orden de aparicion,
// por lo que dotenv debe ser el primer import y su .config() debe llamarse
// inmediatamente despues, antes de importar app.ts (que lee JWT_SECRET, DATABASE_URL, etc.)
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { initSocket } from './lib/socket';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

// Crear el servidor HTTP base sobre el que se monta Express y Socket.IO
const httpServer = http.createServer(app);

// Inicializar Socket.IO para comunicacion en tiempo real.
// Se usa para: actualizaciones del KDS (cocina), cambios de estado de mesas,
// alertas de stock bajo, y notificaciones a mozos cuando un plato esta listo.
initSocket(httpServer);

// Inicializar el procesador de webhooks (BullMQ Worker).
// Solo se activa si Redis esta disponible, ya que BullMQ lo requiere como backend.
// En entornos sin Redis (desarrollo local simple), los webhooks no se procesan
// de forma asincrona pero la app sigue funcionando para el POS basico.
if (process.env.REDIS_HOST || process.env.ENABLE_QUEUE_WORKERS === 'true') {
    import('./integrations/delivery').then(({ initWebhookProcessor }) => {
        initWebhookProcessor();
        logger.info('Webhook queue processor initialized');
    }).catch((err) => {
        logger.warn('Failed to initialize webhook processor (Redis may not be available)', {
            error: err.message,
        });
    });
}

// Vincular a 0.0.0.0 en lugar de localhost para compatibilidad con Docker.
// Dentro de un contenedor, localhost solo escucha en la interfaz loopback
// y no seria accesible desde fuera del contenedor.
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    logger.info('Server started', { port: PORT });
    logger.info('WebSocket server initialized');
});

// =============================================================================
// APAGADO GRACEFUL (GRACEFUL SHUTDOWN)
// Cuando el proceso recibe SIGTERM (Docker stop) o SIGINT (Ctrl+C), se ejecuta
// una secuencia ordenada de cierre para no cortar operaciones en progreso.
// =============================================================================
let isShuttingDown = false;

const shutdown = async (signal: string) => {
    // Evitar multiples ejecuciones si llegan senales simultaneas
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Received shutdown signal, starting graceful shutdown...', { signal });

    // 1. Dejar de aceptar nuevas conexiones HTTP
    httpServer.close(() => {
        logger.info('HTTP server closed');
    });

    // 2. Cerrar conexiones WebSocket activas
    try {
        const { getIO } = await import('./lib/socket');
        const io = getIO();
        if (io) {
            io.close();
            logger.info('WebSocket server closed');
        }
    } catch { /* Socket.IO podria no estar inicializado */ }

    // 3. Cerrar workers de BullMQ si estan corriendo.
    // Esto espera a que los jobs en progreso terminen antes de cerrar.
    try {
        const { bullMQService } = await import('./lib/queue/BullMQService');
        await bullMQService.close();
        logger.info('BullMQ workers closed');
    } catch { /* BullMQ podria no estar inicializado */ }

    // 4. Desconectar Prisma para liberar el pool de conexiones a MySQL
    try {
        const { prisma } = await import('./lib/prisma');
        await prisma.$disconnect();
        logger.info('Database connections closed');
    } catch { /* Prisma podria no estar inicializado */ }

    logger.info('Graceful shutdown complete');
    process.exit(0);
};

// Escuchar senales del sistema operativo para iniciar el apagado graceful
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// HANDLERS DE ERRORES NO CAPTURADOS
// Estos son la ultima linea de defensa contra errores que escaparon de todos
// los try/catch y middleware de errores de Express.
// =============================================================================
process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
    });
    // En produccion, un rechazo no manejado indica un bug serio.
    // Apagamos el proceso de forma segura para evitar estados inconsistentes.
    if (process.env.NODE_ENV === 'production') {
        shutdown('unhandledRejection');
    }
});

process.on('uncaughtException', (error: Error) => {
    // Una excepcion no capturada deja el proceso en estado indeterminado.
    // No hay forma segura de continuar, asi que logueamos y salimos inmediatamente.
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
