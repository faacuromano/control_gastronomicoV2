import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';

// Environment validation
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// P2-06: Validate critical environment variables
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;
for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
        throw new Error(`CRITICAL: Missing required environment variable: ${envVar}`);
    }
}
// CORS_ORIGINS validation is handled below in the CORS configuration block

// Conditional: if queue workers enabled, Redis must be configured
if (process.env.ENABLE_QUEUE_WORKERS === 'true' && !process.env.REDIS_HOST) {
    throw new Error('CRITICAL: REDIS_HOST is required when ENABLE_QUEUE_WORKERS=true');
}
if (process.env.ENABLE_QUEUE_WORKERS === 'true' && !process.env.REDIS_PASSWORD) {
    logger.warn('[CONFIG] REDIS_PASSWORD not set — Redis connection may fail if authentication is required');
}

// CORS Configuration - Use CORS_ORIGINS env var for production
// SEC-026: In production, require explicit CORS_ORIGINS to prevent localhost fallback
const allowedOrigins = process.env.CORS_ORIGINS?.split(',')
    || (isProduction ? [] : ['http://localhost:5173', 'http://localhost:5174']);

// SECURITY: Block startup if CORS not configured in production
if (isProduction && !process.env.CORS_ORIGINS) {
    throw new Error(
        'CRITICAL: CORS_ORIGINS must be set in production. ' +
        'Set CORS_ORIGINS=https://yourdomain.com in your .env'
    );
}

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// FIX P0-004: Cookie parser for HttpOnly cookie authentication
app.use(cookieParser());

// FIX P1-002: Sanitize body to prevent prototype pollution
import { sanitizeBody } from './middleware/sanitize-body.middleware';
app.use(sanitizeBody); // CRITICAL: Apply AFTER body parsers, BEFORE routes

// P1-27: Correlation ID for distributed tracing
import { correlationId } from './middleware/correlationId';

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet({
  // SEC-020: Explicit CSP for production; disabled in dev for hot-reload
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(process.env.CORS_ORIGINS?.split(',') || [])],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  crossOriginEmbedderPolicy: false, // Allow loading images from external sources
}));
app.use(correlationId);
app.use(morgan('dev'));
app.use(compression());

// CSRF protection: require X-Requested-With header on state-changing requests
import { csrfProtection } from './middleware/csrf';
app.use('/api/', csrfProtection);

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

// API-003: Versioning Strategy
// All routes are mounted under /api/v1. When breaking changes are needed:
// 1. Create new route files under /api/v2 with updated contracts
// 2. Keep /api/v1 routes active for backward compatibility (minimum 6 months)
// 3. Add Deprecation header to v1 responses: res.set('Deprecation', 'true')
// 4. Document migration guide in release notes
// 5. Monitor v1 usage via access logs before decommissioning
// Non-breaking changes (new fields, new endpoints) are added to v1 directly.
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

// Health Check — deep check verifying database connectivity
app.get('/health', async (_req, res) => {
    const checks: Record<string, boolean> = { database: false };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = true;
    } catch { /* DB unreachable */ }

    const healthy = Object.values(checks).every(Boolean);
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks
    });
});

// Error Handling (must be after all routes)
import { errorHandler, notFoundHandler } from './middleware/error';

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;

