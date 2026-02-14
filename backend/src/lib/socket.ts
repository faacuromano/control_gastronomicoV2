/**
 * @fileoverview Inicializacion y gestion de Socket.IO para comunicacion en tiempo real
 *
 * Este modulo configura Socket.IO sobre el servidor HTTP existente para habilitar
 * comunicacion bidireccional en tiempo real. Se usa para:
 * - KDS (Kitchen Display System): notificar a cocina cuando llegan nuevos pedidos
 * - Mozos: alertar cuando un plato esta listo para servir
 * - Mesas: actualizar el estado en tiempo real (libre, ocupada, reservada)
 * - Stock: alertas de stock bajo al panel de administracion
 *
 * Toda la comunicacion esta aislada por tenant usando rooms con prefijo
 * `tenant:{id}:` para garantizar que los datos de un restaurante nunca
 * se filtren a otro.
 *
 * @module lib/socket
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import jwt from 'jsonwebtoken';
import { JWT_ISSUER, JWT_AUDIENCE } from '../services/auth.service';
import { logger } from '../utils/logger';

// Instancia singleton de Socket.IO, undefined hasta que se llame initSocket()
/** Type-safe socket user data attached during JWT authentication */
interface SocketUserData {
  user: {
    id: number;
    role: string;
    name: string;
    tenantId: number;
    permissions?: unknown;
  };
}

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketUserData> | undefined;

/**
 * Inicializa el servidor Socket.IO sobre el servidor HTTP existente.
 * Configura CORS, autenticacion JWT, adaptador Redis (si disponible),
 * y los handlers de rooms por tenant.
 */
export const initSocket = (httpServer: HttpServer) => {
  // FIX: Lockdown CORS de Socket.IO - Usar origenes configurados por entorno,
  // igual que el CORS de Express, para mantener consistencia de seguridad
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) ||
    (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:5174']);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // P1-15: Adaptador Redis para escalado horizontal (multi-pod).
  // Sin Redis, Socket.IO solo funciona en una instancia. Con el adaptador,
  // los eventos se comparten entre todos los pods via pub/sub de Redis,
  // permitiendo que un usuario conectado al pod A reciba eventos emitidos desde el pod B.
  if (process.env.REDIS_HOST) {
    import('@socket.io/redis-adapter').then(async ({ createAdapter }) => {
      // PERF-003: Usar import() dinámico en vez de require() para consistencia con ESM
      const ioredis = await import('ioredis');
      const RedisClient = ioredis.default ?? ioredis.Redis;
      const pubClient = new RedisClient({
        host: process.env.REDIS_HOST!,
        port: Number(process.env.REDIS_PORT || 6379),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
      });
      const subClient = pubClient.duplicate();
      io!.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized for horizontal scaling');
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Socket.IO Redis adapter not available, using in-memory adapter', { error: message });
    });
  }

  // --- Middleware de autenticacion JWT ---
  // Cada conexion WebSocket debe presentar un token JWT valido.
  // Se intenta obtener de: 1) handshake auth, 2) cookie HttpOnly.
  io.use((socket, next) => {
    try {
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        logger.error('JWT_SECRET not configured, rejecting WebSocket connection');
        return next(new Error('Server misconfiguration'));
      }

      // 1. Intentar obtener el token del handshake (para clientes que lo pasan explicitamente)
      let token: string | undefined = socket.handshake.auth?.token;

      // 2. Fallback: extraer de la cookie HttpOnly `auth_token`.
      // El navegador envia las cookies automaticamente con la peticion de upgrade a WS.
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
          const authCookie = cookieHeader
            .split(';')
            .find(c => c.trim().startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.substring(authCookie.indexOf('=') + 1);
          }
        }
      }

      if (!token) {
        logger.warn('WebSocket connection rejected: no auth token', { socketId: socket.id });
        return next(new Error('Authentication required'));
      }

      // FIX-003 (SEC-003): Verificar JWT restringiendo a HS256 para prevenir
      // ataques de alg:none y confusion de algoritmos (consistente con auth.ts:115)
      // SEC-P2-01: Validate issuer/audience on WebSocket auth to match HTTP auth middleware
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as {
        id: number;
        role: string;
        name: string;
        tenantId: number;
        permissions?: unknown;
      };

      // Validar que el token incluya tenantId (requerido para aislamiento multi-tenant)
      if (!decoded.tenantId) {
        logger.warn('WebSocket connection rejected: token missing tenantId', { socketId: socket.id, userId: decoded.id });
        return next(new Error('Invalid token: missing tenantId'));
      }

      // Guardar los datos del usuario en el socket para uso posterior
      socket.data.user = decoded;
      logger.info('[Socket] Auth middleware passed', { socketId: socket.id, userId: decoded.id, tenantId: decoded.tenantId });
      next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('WebSocket authentication failed', { socketId: socket.id, error: message });
      return next(new Error('Authentication failed'));
    }
  });

  // Handler de conexiones autenticadas
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    const tenantId = user.tenantId;
    logger.info('[Socket] WebSocket client connected', { socketId: socket.id, userId: user.id, tenantId });

    socket.on('disconnect', (reason) => {
      logger.info('[Socket] WebSocket client disconnected', { socketId: socket.id, userId: user.id, tenantId, reason });
    });

    // --- Gestion de Rooms (todas las rooms estan aisladas por tenant) ---

    // SEC-031: Helper para validar y unir rooms con scope de tenant.
    // Previene cualquier intento de unirse a rooms fuera del namespace del tenant autenticado.
    // Todas las rooms siguen el formato `tenant:{tenantId}:{sufijo}`.
    const joinTenantRoom = (roomSuffix: string) => {
        const room = `tenant:${tenantId}:${roomSuffix}`;
        socket.join(room);
        logger.info(`[Socket] Socket joined room: ${room}`, { socketId: socket.id, tenantId });
    };

    // SEC-AUD-001: Reject ALL direct room join attempts unconditionally.
    // Clients must use specific handlers (join:kitchen, join:table, etc.) that enforce tenant scoping.
    socket.on('join', (room: unknown) => {
        logger.warn('Rejected direct room join attempt — use specific join handlers', {
            socketId: socket.id,
            tenantId,
            requestedRoom: typeof room === 'string' ? room : String(room),
        });
        socket.emit('error', { message: 'Direct room joins are not allowed. Use join:kitchen, join:table, etc.' });
    });

    // Room de cocina general - recibe todos los eventos de ordenes nuevas y cambios de items
    socket.on('join:kitchen', () => {
        joinTenantRoom('kitchen');
        logger.info('[Socket] Client joined kitchen room', { socketId: socket.id, tenantId, userId: user.id });
    });

    // Estaciones de cocina especificas (ej: 'tenant:1:kitchen:station:hot' para cocina caliente)
    socket.on('join:kitchen:station', (station: string) => {
        // Sanitizar el nombre de estacion para prevenir inyeccion de room
        const safeStation = String(station).replace(/[^a-zA-Z0-9_-]/g, '');
        joinTenantRoom(`kitchen:station:${safeStation}`);
        logger.info('[Socket] Client joined station room', { socketId: socket.id, tenantId, station: safeStation });
    });

    // Room de mozos - reciben alertas cuando un plato esta listo para servir
    socket.on('join:waiters', () => {
        joinTenantRoom('waiters');
    });

    // Room de mesa especifica - para futuras actualizaciones al cliente sentado en esa mesa
    socket.on('join:table', (tableId: number) => {
        const safeTableId = parseInt(String(tableId), 10);
        if (isNaN(safeTableId) || safeTableId <= 0) return;
        joinTenantRoom(`table:${safeTableId}`);
    });

    // Room de alertas de stock para administradores
    socket.on('join:admin:stock', () => {
        joinTenantRoom('admin:stock');
    });
  });

  return io;
};

/**
 * Obtiene la instancia de Socket.IO para emitir eventos desde los servicios.
 * Retorna null si Socket.IO no fue inicializado (ej: en tests unitarios).
 * Los servicios deben manejar el caso null sin lanzar error.
 */
export const getIO = (): Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketUserData> | null => {
  if (!io) {
    logger.warn('Socket.IO not initialized, real-time updates disabled');
    return null;
  }
  return io;
};
