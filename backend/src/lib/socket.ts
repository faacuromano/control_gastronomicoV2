import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { logger } from '../utils/logger';

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | undefined;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins for now, configure for production later
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.debug('WebSocket client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.debug('WebSocket client disconnected', { socketId: socket.id });
    });
    
    // Join room logic can go here (e.g. socket.join('kitchen'))
    socket.on('join:kitchen', () => {
        socket.join('kitchen');
        logger.debug('Socket joined kitchen room', { socketId: socket.id });
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
