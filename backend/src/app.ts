import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// Environment validation
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// CORS Configuration - Use CORS_ORIGINS env var for production
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];

// SECURITY: Warn if using default CORS in production
if (isProduction && !process.env.CORS_ORIGINS) {
    console.error(
        '[SECURITY WARNING] CORS_ORIGINS not configured in production! ' +
        'Defaulting to localhost which may block legitimate requests. ' +
        'Set CORS_ORIGINS=https://yourdomain.com in your .env'
    );
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FIX P1-002: Sanitize body to prevent prototype pollution
import { sanitizeBody } from './middleware/sanitize-body.middleware';
app.use(sanitizeBody); // CRITICAL: Apply AFTER body parsers, BEFORE routes

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());

// Routes - API v1
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import inventoryRoutes from './routes/inventory.routes';
import orderRoutes from './routes/order.routes';
import cashShiftRoutes from './routes/cashShift.routes';
import configRoutes from './routes/config.routes';
import { tableRouter } from './routes/table.routes';
import deliveryRoutes from './routes/delivery.routes';
import clientRoutes from './routes/client.routes';
import userRoutes from './routes/user.routes';
import roleRoutes from './routes/role.routes';
import printerRoutes from './routes/printer.routes';
import modifierRoutes from './routes/modifier.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseOrderRoutes from './routes/purchaseOrder.routes';
import analyticsRoutes from './routes/analytics.routes';
import paymentMethodRoutes from './routes/paymentMethod.routes';
import invoiceRoutes from './routes/invoice.routes';
import loyaltyRoutes from './routes/loyalty.routes';
import printRoutingRoutes from './routes/printRouting.routes';
import stockAlertRoutes from './routes/stockAlert.routes';
import discountRoutes from './routes/discount.routes';

// Register all routes under /api/v1 for versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1', inventoryRoutes);   // ingredients, stock-movements
app.use('/api/v1', menuRoutes);         // categories, products
app.use('/api/v1/cash-shifts', cashShiftRoutes);
app.use('/api/v1', configRoutes);       // /config
app.use('/api/v1', tableRouter);        // /tables, /areas
app.use('/api/v1/print', printerRoutes); // /print
app.use('/api/v1/print-routing', printRoutingRoutes); // Print routing config
app.use('/api/v1/modifiers', modifierRoutes);
app.use('/api/v1', supplierRoutes);      // /suppliers
app.use('/api/v1', purchaseOrderRoutes); // /purchase-orders
app.use('/api/v1', analyticsRoutes);     // /analytics/*
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/stock-alerts', stockAlertRoutes);
app.use('/api/v1/discounts', discountRoutes);
import bulkPriceRoutes from './routes/bulkPriceUpdate.routes';
app.use('/api/v1/bulk-prices', bulkPriceRoutes);
import syncRoutes from './routes/sync.routes';
app.use('/api/v1/sync', syncRoutes);
import { qrPublicRouter, qrAdminRouter } from './routes/qr.routes';
app.use('/api/v1/qr', qrPublicRouter);        // Public: /api/v1/qr/:code
app.use('/api/v1/admin/qr', qrAdminRouter);   // Admin: /api/v1/admin/qr/...

// Delivery Platform Webhooks (Rappi, Glovo, PedidosYa)
// NOTA: Estas rutas usan express.raw() internamente para validación HMAC
import { webhookRoutes } from './integrations/delivery';
app.use('/api/v1/webhooks', webhookRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handling (must be after all routes)
import { errorHandler, notFoundHandler } from './middleware/error';

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;

