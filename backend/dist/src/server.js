"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_1 = require("./lib/socket");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
const PORT = process.env.PORT || 3001;
const httpServer = http_1.default.createServer(app_1.default);
// Initialize Socket.IO
(0, socket_1.initSocket)(httpServer);
httpServer.listen(PORT, () => {
    logger_1.logger.info('Server started', { port: PORT });
    logger_1.logger.info('WebSocket server initialized');
});
//# sourceMappingURL=server.js.map