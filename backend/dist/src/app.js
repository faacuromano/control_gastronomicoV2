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
// Environment validation
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;
// CORS Configuration - Use CORS_ORIGINS env var for production
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
// SECURITY: Warn if using default CORS in production
if (isProduction && !process.env.CORS_ORIGINS) {
    console.error('[SECURITY WARNING] CORS_ORIGINS not configured in production! ' +
        'Defaulting to localhost which may block legitimate requests. ' +
        'Set CORS_ORIGINS=https://yourdomain.com in your .env');
}
const app = (0, express_1.default)();
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// FIX P1-002: Sanitize body to prevent prototype pollution
const sanitize_body_middleware_1 = require("./middleware/sanitize-body.middleware");
app.use(sanitize_body_middleware_1.sanitizeBody); // CRITICAL: Apply AFTER body parsers, BEFORE routes
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
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
const delivery_routes_1 = __importDefault(require("./routes/delivery.routes"));
const client_routes_1 = __importDefault(require("./routes/client.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const role_routes_1 = __importDefault(require("./routes/role.routes"));
const printer_routes_1 = __importDefault(require("./routes/printer.routes"));
const modifier_routes_1 = __importDefault(require("./routes/modifier.routes"));
const supplier_routes_1 = __importDefault(require("./routes/supplier.routes"));
const purchaseOrder_routes_1 = __importDefault(require("./routes/purchaseOrder.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const paymentMethod_routes_1 = __importDefault(require("./routes/paymentMethod.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
const loyalty_routes_1 = __importDefault(require("./routes/loyalty.routes"));
const printRouting_routes_1 = __importDefault(require("./routes/printRouting.routes"));
const stockAlert_routes_1 = __importDefault(require("./routes/stockAlert.routes"));
const discount_routes_1 = __importDefault(require("./routes/discount.routes"));
// Register all routes under /api/v1 for versioning
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/users', user_routes_1.default);
app.use('/api/v1/roles', role_routes_1.default);
app.use('/api/v1/clients', client_routes_1.default);
app.use('/api/v1/orders', order_routes_1.default);
app.use('/api/v1/delivery', delivery_routes_1.default);
app.use('/api/v1', inventory_routes_1.default); // ingredients, stock-movements
app.use('/api/v1', menu_routes_1.default); // categories, products
app.use('/api/v1/cash-shifts', cashShift_routes_1.default);
app.use('/api/v1', config_routes_1.default); // /config
app.use('/api/v1', table_routes_1.tableRouter); // /tables, /areas
app.use('/api/v1/print', printer_routes_1.default); // /print
app.use('/api/v1/print-routing', printRouting_routes_1.default); // Print routing config
app.use('/api/v1/modifiers', modifier_routes_1.default);
app.use('/api/v1', supplier_routes_1.default); // /suppliers
app.use('/api/v1', purchaseOrder_routes_1.default); // /purchase-orders
app.use('/api/v1', analytics_routes_1.default); // /analytics/*
app.use('/api/v1/payment-methods', paymentMethod_routes_1.default);
app.use('/api/v1/invoices', invoice_routes_1.default);
app.use('/api/v1/loyalty', loyalty_routes_1.default);
app.use('/api/v1/stock-alerts', stockAlert_routes_1.default);
app.use('/api/v1/discounts', discount_routes_1.default);
const bulkPriceUpdate_routes_1 = __importDefault(require("./routes/bulkPriceUpdate.routes"));
app.use('/api/v1/bulk-prices', bulkPriceUpdate_routes_1.default);
const sync_routes_1 = __importDefault(require("./routes/sync.routes"));
app.use('/api/v1/sync', sync_routes_1.default);
const qr_routes_1 = require("./routes/qr.routes");
app.use('/api/v1/qr', qr_routes_1.qrPublicRouter); // Public: /api/v1/qr/:code
app.use('/api/v1/admin/qr', qr_routes_1.qrAdminRouter); // Admin: /api/v1/admin/qr/...
// Delivery Platform Webhooks (Rappi, Glovo, PedidosYa)
// NOTA: Estas rutas usan express.raw() internamente para validación HMAC
const delivery_1 = require("./integrations/delivery");
app.use('/api/v1/webhooks', delivery_1.webhookRoutes);
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