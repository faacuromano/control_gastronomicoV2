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


