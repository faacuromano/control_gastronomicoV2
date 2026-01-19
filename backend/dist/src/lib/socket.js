"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
let io;
const initSocket = (httpServer) => {
    // FIX: Socket.io CORS Lockdown - Use environment-configured origins
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) ||
        (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']);
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: allowedOrigins.length > 0 ? allowedOrigins : false,
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    io.on('connection', (socket) => {
        logger_1.logger.debug('WebSocket client connected', { socketId: socket.id });
        socket.on('disconnect', () => {
            logger_1.logger.debug('WebSocket client disconnected', { socketId: socket.id });
        });
        // --- Room Management ---
        // Kitchen (General)
        socket.on('join:kitchen', () => {
            socket.join('kitchen');
            logger_1.logger.debug('Socket joined room: kitchen', { socketId: socket.id });
        });
        // Kitchen Stations (e.g., 'kitchen:station:hot', 'kitchen:station:cold')
        socket.on('join:kitchen:station', (station) => {
            const room = `kitchen:station:${station}`;
            socket.join(room);
            logger_1.logger.debug(`Socket joined room: ${room}`, { socketId: socket.id });
        });
        // Waiters (for ready alerts)
        socket.on('join:waiters', () => {
            socket.join('waiters');
            logger_1.logger.debug('Socket joined room: waiters', { socketId: socket.id });
        });
        // Specific Table (for customer updates in future)
        socket.on('join:table', (tableId) => {
            const room = `table:${tableId}`;
            socket.join(room);
            logger_1.logger.debug(`Socket joined room: ${room}`, { socketId: socket.id });
        });
        // Admin stock alerts room
        socket.on('join:admin:stock', () => {
            socket.join('admin:stock');
            logger_1.logger.debug('Socket joined room: admin:stock', { socketId: socket.id });
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
exports.getIO = getIO;
//# sourceMappingURL=socket.js.map