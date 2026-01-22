import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { logger } from '../utils/logger';

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | undefined;

export const initSocket = (httpServer: HttpServer) => {
  // FIX: Socket.io CORS Lockdown - Use environment-configured origins
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || 
    (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:5174']);
  
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.debug('WebSocket client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.debug('WebSocket client disconnected', { socketId: socket.id });
    });
    
    // --- Room Management ---
    
    // Kitchen (General)
    socket.on('join:kitchen', () => {
        socket.join('kitchen');
        logger.debug('Socket joined room: kitchen', { socketId: socket.id });
    });

    // Kitchen Stations (e.g., 'kitchen:station:hot', 'kitchen:station:cold')
    socket.on('join:kitchen:station', (station: string) => {
        const room = `kitchen:station:${station}`;
        socket.join(room);
        logger.debug(`Socket joined room: ${room}`, { socketId: socket.id });
    });

    // Waiters (for ready alerts)
    socket.on('join:waiters', () => {
        socket.join('waiters');
        logger.debug('Socket joined room: waiters', { socketId: socket.id });
    });

    // Specific Table (for customer updates in future)
    socket.on('join:table', (tableId: number) => {
        const room = `table:${tableId}`;
        socket.join(room);
        logger.debug(`Socket joined room: ${room}`, { socketId: socket.id });
    });
    
    // Admin stock alerts room
    socket.on('join:admin:stock', () => {
        socket.join('admin:stock');
        logger.debug('Socket joined room: admin:stock', { socketId: socket.id });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
