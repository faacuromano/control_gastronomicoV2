import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import jwt from 'jsonwebtoken';
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

  // P1-15: Redis adapter for horizontal scaling (multi-pod)
  if (process.env.REDIS_HOST) {
    import('@socket.io/redis-adapter').then(({ createAdapter }) => {
      const { Redis } = require('ioredis');
      const pubClient = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379) });
      const subClient = pubClient.duplicate();
      io!.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized for horizontal scaling');
    }).catch((err: any) => {
      logger.warn('Socket.IO Redis adapter not available, using in-memory adapter', { error: err.message });
    });
  }

  // --- JWT Authentication Middleware ---
  io.use((socket, next) => {
    try {
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        logger.error('JWT_SECRET not configured, rejecting WebSocket connection');
        return next(new Error('Server misconfiguration'));
      }

      // 1. Try explicit auth token from handshake (for clients that pass it)
      let token: string | undefined = socket.handshake.auth?.token;

      // 2. Fallback: extract from HttpOnly cookie
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
          const authCookie = cookieHeader
            .split(';')
            .find(c => c.trim().startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.split('=')[1];
          }
        }
      }

      if (!token) {
        logger.warn('WebSocket connection rejected: no auth token', { socketId: socket.id });
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: number;
        role: string;
        name: string;
        tenantId: number;
        permissions?: unknown;
      };

      if (!decoded.tenantId) {
        logger.warn('WebSocket connection rejected: token missing tenantId', { socketId: socket.id, userId: decoded.id });
        return next(new Error('Invalid token: missing tenantId'));
      }

      socket.data.user = decoded;
      next();
    } catch (err: any) {
      logger.warn('WebSocket authentication failed', { socketId: socket.id, error: err.message });
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    const tenantId = user.tenantId;
    logger.debug('WebSocket client connected', { socketId: socket.id, userId: user.id, tenantId });

    socket.on('disconnect', () => {
      logger.debug('WebSocket client disconnected', { socketId: socket.id, userId: user.id, tenantId });
    });

    // --- Room Management (all rooms scoped to tenant) ---

    // SEC-031: Helper to validate and join tenant-scoped rooms only.
    // Prevents any attempt to join rooms outside the authenticated tenant's namespace.
    const joinTenantRoom = (roomSuffix: string) => {
        const room = `tenant:${tenantId}:${roomSuffix}`;
        socket.join(room);
        logger.debug(`Socket joined room: ${room}`, { socketId: socket.id, tenantId });
    };

    // SEC-031: Reject any raw room join attempts that bypass tenant scoping
    socket.on('join', (room: string) => {
        if (typeof room === 'string' && !room.startsWith(`tenant:${tenantId}:`)) {
            logger.warn('Rejected cross-tenant room join attempt', {
                socketId: socket.id,
                tenantId,
                requestedRoom: room,
            });
            socket.emit('error', { message: 'Cannot join rooms outside your tenant' });
            return;
        }
    });

    // Kitchen (General)
    socket.on('join:kitchen', () => {
        joinTenantRoom('kitchen');
    });

    // Kitchen Stations (e.g., 'tenant:1:kitchen:station:hot')
    socket.on('join:kitchen:station', (station: string) => {
        // Sanitize station name to prevent room injection
        const safeStation = String(station).replace(/[^a-zA-Z0-9_-]/g, '');
        joinTenantRoom(`kitchen:station:${safeStation}`);
    });

    // Waiters (for ready alerts)
    socket.on('join:waiters', () => {
        joinTenantRoom('waiters');
    });

    // Specific Table (for customer updates in future)
    socket.on('join:table', (tableId: number) => {
        const safeTableId = parseInt(String(tableId), 10);
        if (isNaN(safeTableId) || safeTableId <= 0) return;
        joinTenantRoom(`table:${safeTableId}`);
    });

    // Admin stock alerts room (already tenant-scoped in stockAlert.service.ts)
    socket.on('join:admin:stock', () => {
        joinTenantRoom('admin:stock');
    });
  });

  return io;
};

export const getIO = (): Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | null => {
  if (!io) {
    logger.warn('Socket.IO not initialized, real-time updates disabled');
    return null;
  }
  return io;
};
