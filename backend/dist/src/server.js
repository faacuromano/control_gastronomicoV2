"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
// Initialize Webhook Processor (BullMQ Worker)
// Solo inicializar si Redis está disponible
if (process.env.REDIS_HOST || process.env.ENABLE_QUEUE_WORKERS === 'true') {
    Promise.resolve().then(() => __importStar(require('./integrations/delivery'))).then(({ initWebhookProcessor }) => {
        initWebhookProcessor();
        logger_1.logger.info('Webhook queue processor initialized');
    }).catch((err) => {
        logger_1.logger.warn('Failed to initialize webhook processor (Redis may not be available)', {
            error: err.message,
        });
    });
}
httpServer.listen(PORT, () => {
    logger_1.logger.info('Server started', { port: PORT });
    logger_1.logger.info('WebSocket server initialized');
});
//# sourceMappingURL=server.js.map