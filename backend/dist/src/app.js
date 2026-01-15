"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
// Trigger restart
const PORT = process.env.PORT || 3001;
const app = (0, express_1.default)();
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use((0, compression_1.default)());
// Routes - API v1
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const inventory_routes_1 = __importDefault(require("./routes/inventory.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const cashShift_routes_1 = __importDefault(require("./routes/cashShift.routes"));
const config_routes_1 = __importDefault(require("./routes/config.routes"));
const table_routes_1 = require("./routes/table.routes");
// Register all routes under /api/v1 for versioning
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/orders', order_routes_1.default);
app.use('/api/v1', inventory_routes_1.default); // ingredients, stock-movements
app.use('/api/v1', menu_routes_1.default); // categories, products
app.use('/api/v1/cash-shifts', cashShift_routes_1.default);
app.use('/api/v1', config_routes_1.default); // /config
app.use('/api/v1', table_routes_1.tableRouter); // /tables, /areas
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error Handling (must be after all routes)
const error_1 = require("./middleware/error");
// 404 handler for undefined routes
app.use(error_1.notFoundHandler);
// Global error handler
app.use(error_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map