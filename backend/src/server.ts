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

httpServer.listen(PORT, () => {
    logger.info('Server started', { port: PORT });
    logger.info('WebSocket server initialized');
});

