import http from 'http';
import app from './app';
import dotenv from 'dotenv';
import { initSocket } from './lib/socket';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);

// Initialize Socket.IO
initSocket(httpServer);

// Initialize Webhook Processor (BullMQ Worker)
// Solo inicializar si Redis está disponible
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

// BIND TO 0.0.0.0 FOR DOCKER COMPATIBILITY
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    logger.info('Server started', { port: PORT });
    logger.info('WebSocket server initialized');
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================
let isShuttingDown = false;

const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Received shutdown signal, starting graceful shutdown...', { signal });

    // 1. Stop accepting new connections
    httpServer.close(() => {
        logger.info('HTTP server closed');
    });

    // 2. Close WebSocket connections
    try {
        const { getIO } = await import('./lib/socket');
        const io = getIO();
        if (io) {
            io.close();
            logger.info('WebSocket server closed');
        }
    } catch { /* Socket.IO may not be initialized */ }

    // 3. Close BullMQ workers if running
    try {
        const { bullMQService } = await import('./lib/queue/BullMQService');
        await bullMQService.close();
        logger.info('BullMQ workers closed');
    } catch { /* BullMQ may not be initialized */ }

    // 4. Disconnect Prisma
    try {
        const { prisma } = await import('./lib/prisma');
        await prisma.$disconnect();
        logger.info('Database connections closed');
    } catch { /* Prisma may not be initialized */ }

    logger.info('Graceful shutdown complete');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
