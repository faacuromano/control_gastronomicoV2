/**
 * @fileoverview Configuracion principal de la aplicacion Express
 *
 * Este archivo es el punto de entrada de la capa HTTP. Aqui se ensambla toda la
 * cadena de middlewares (seguridad, parseo, CORS, compresion) y se montan todas
 * las rutas de la API v1. El orden de los middlewares es critico: primero se
 * parsea el body, luego se sanitiza, y finalmente se aplican las rutas.
 *
 * La aplicacion sigue una arquitectura multi-tenant donde cada peticion
 * autenticada lleva un tenantId en el JWT. Las rutas publicas (health, QR)
 * no requieren autenticacion.
 *
 * @module app
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';

// Validacion del entorno: determinamos si estamos en produccion para ajustar
// comportamientos de seguridad (CORS estricto, CSP, HSTS)
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// P2-06: Validacion de variables de entorno criticas al arrancar.
// Si faltan, la app no puede funcionar (sin DB no hay datos, sin JWT no hay auth).
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;
for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
        throw new Error(`CRITICAL: Missing required environment variable: ${envVar}`);
    }
}
// La validacion de CORS_ORIGINS se maneja mas abajo en el bloque de configuracion CORS

// Condicional: si los workers de cola estan habilitados, Redis debe estar configurado.
// BullMQ necesita Redis para funcionar; sin el, los webhooks de delivery no se procesan.
if (process.env.ENABLE_QUEUE_WORKERS === 'true' && !process.env.REDIS_HOST) {
    throw new Error('CRITICAL: REDIS_HOST is required when ENABLE_QUEUE_WORKERS=true');
}
if (process.env.ENABLE_QUEUE_WORKERS === 'true' && !process.env.REDIS_PASSWORD) {
    logger.warn('[CONFIG] REDIS_PASSWORD not set — Redis connection may fail if authentication is required');
}

// Configuracion CORS: en desarrollo se permiten los puertos de Vite (5173/5174).
// SEC-026: En produccion se exige CORS_ORIGINS explicito para evitar que
// quede abierto a localhost por error de despliegue.
const allowedOrigins = process.env.CORS_ORIGINS?.split(',')
    || (isProduction ? [] : ['http://localhost:5173', 'http://localhost:5174']);

// SEGURIDAD: Bloquear el arranque si CORS no esta configurado en produccion.
// Esto previene que un deploy olvide configurar los origenes y quede expuesto.
if (isProduction && !process.env.CORS_ORIGINS) {
    throw new Error(
        'CRITICAL: CORS_ORIGINS must be set in production. ' +
        'Set CORS_ORIGINS=https://yourdomain.com in your .env'
    );
}

const app = express();

// =============================================================================
// CADENA DE MIDDLEWARES
// El orden importa: parseo -> sanitizacion -> seguridad -> rutas -> errores
// =============================================================================

// Parseo del body JSON y URL-encoded con limite de 1MB para prevenir payloads gigantes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// FIX P0-004: Cookie parser necesario para leer la cookie HttpOnly `auth_token`
// que contiene el JWT. Sin esto, la autenticacion basada en cookies no funciona.
app.use(cookieParser());

// FIX P1-002: Sanitizacion del body para prevenir ataques de prototype pollution.
// Un atacante podria enviar { "__proto__": { "isAdmin": true } } y escalar privilegios.
import { sanitizeBody } from './middleware/sanitize-body.middleware';
app.use(sanitizeBody); // CRITICO: Aplicar DESPUES de los body parsers y ANTES de las rutas

// P1-27: ID de correlacion para trazabilidad distribuida.
// Cada request recibe un UUID unico que se propaga en los logs para poder
// rastrear una peticion a traves de todos los servicios.
import { correlationId } from './middleware/correlationId';

// CORS con credenciales habilitadas para que el navegador envie las cookies
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Helmet configura headers de seguridad HTTP (X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
  // SEC-020: CSP explicito en produccion; deshabilitado en desarrollo para hot-reload de Vite
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Requerido para estilos inline de TailwindCSS
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(process.env.CORS_ORIGINS?.split(',') || [])],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  crossOriginEmbedderPolicy: false, // Permitir carga de imagenes externas
  // SEC-P4-05: Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));
// SEC-P4-05: Permissions-Policy — restrict browser features this app doesn't use
// Prevents iframed contexts or injected scripts from accessing sensitive APIs
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});
app.use(correlationId);
// API-004: Logging estructurado de requests en formato JSON con correlation ID
import { requestLogger } from './middleware/requestLogger';
app.use(requestLogger);
// Compresion gzip de las respuestas para reducir el ancho de banda
// PERF-002: Solo comprimir respuestas mayores a 1KB para evitar overhead en respuestas pequeñas
app.use(compression({ threshold: 1024 }));

// SEC-FIX: Global API rate limiter applied to ALL endpoints as baseline DoS protection.
// Individual routes may apply stricter limits (e.g., authRateLimiter for login).
import { apiRateLimiter } from './middleware/rateLimit';
app.use('/api/', apiRateLimiter);

// Proteccion CSRF: exige el header X-Requested-With en peticiones que modifican estado.
// Esto previene que sitios maliciosos hagan requests POST/PUT/DELETE en nombre del usuario.
import { csrfProtection } from './middleware/csrf';
app.use('/api/', csrfProtection);

// =============================================================================
// RUTAS - API v1
// Cada modulo tiene su propio archivo de rutas que define endpoints y middlewares
// de autenticacion/autorizacion especificos.
// =============================================================================
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
import kdsStationRoutes from './routes/kdsStation.routes';
import stockAlertRoutes from './routes/stockAlert.routes';
import discountRoutes from './routes/discount.routes';
import auditRoutes from './routes/audit.routes';

// API-003: Estrategia de versionado
// Todas las rutas se montan bajo /api/v1. Cuando se necesiten cambios que rompan
// compatibilidad:
// 1. Crear nuevos archivos de rutas bajo /api/v2 con los contratos actualizados
// 2. Mantener las rutas /api/v1 activas para compatibilidad hacia atras (minimo 6 meses)
// 3. Agregar header Deprecation a las respuestas v1: res.set('Deprecation', 'true')
// 4. Documentar la guia de migracion en las notas de la release
// 5. Monitorear el uso de v1 via logs de acceso antes de descomisionar
// Los cambios no destructivos (nuevos campos, nuevos endpoints) se agregan directamente a v1.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1', inventoryRoutes);   // ingredientes, movimientos de stock
app.use('/api/v1', menuRoutes);         // categorias, productos
app.use('/api/v1/cash-shifts', cashShiftRoutes);
app.use('/api/v1', configRoutes);       // /config
app.use('/api/v1', tableRouter);        // /tables, /areas
app.use('/api/v1/print', printerRoutes); // /print
app.use('/api/v1/print-routing', printRoutingRoutes); // Configuracion de ruteo de impresion
app.use('/api/v1/kds-stations', kdsStationRoutes);   // Estaciones KDS para enrutamiento de items
app.use('/api/v1/modifiers', modifierRoutes);
app.use('/api/v1', supplierRoutes);      // /suppliers
app.use('/api/v1', purchaseOrderRoutes); // /purchase-orders
app.use('/api/v1', analyticsRoutes);     // /analytics/*
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/stock-alerts', stockAlertRoutes);
app.use('/api/v1/discounts', discountRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
import bulkPriceRoutes from './routes/bulkPriceUpdate.routes';
app.use('/api/v1/bulk-prices', bulkPriceRoutes);
import syncRoutes from './routes/sync.routes';
app.use('/api/v1/sync', syncRoutes);
import { qrPublicRouter, qrAdminRouter } from './routes/qr.routes';
app.use('/api/v1/qr', qrPublicRouter);        // Publico: /api/v1/qr/:code (sin autenticacion)
app.use('/api/v1/admin/qr', qrAdminRouter);   // Admin: /api/v1/admin/qr/... (requiere auth)

// Webhooks de plataformas de delivery (Rappi, Glovo, PedidosYa)
// NOTA: Estas rutas usan express.raw() internamente para validacion HMAC
// de la firma del webhook, por eso no pueden pasar por el JSON parser normal.
import { webhookRoutes } from './integrations/delivery';
app.use('/api/v1/webhooks', webhookRoutes);

// Health Check — verificacion profunda que confirma conectividad con la base de datos.
// Usado por Docker healthcheck y balanceadores de carga para determinar si la instancia
// esta lista para recibir trafico. Retorna 503 si la DB no responde.
app.get('/health', async (_req, res) => {
    const checks: Record<string, boolean> = { database: false };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = true;
    } catch { /* DB inalcanzable */ }

    const healthy = Object.values(checks).every(Boolean);
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        // SEC-010: uptime removido — exponer el uptime del proceso facilita ataques de timing
        checks
    });
});

// =============================================================================
// MANEJO DE ERRORES (debe ir despues de todas las rutas)
// =============================================================================
import { errorHandler, notFoundHandler } from './middleware/error';

// Handler 404 para rutas no definidas — captura cualquier request que no matcheo ninguna ruta
app.use(notFoundHandler);

// Handler global de errores — captura todos los ApiError y sus subclases,
// formatea la respuesta con el codigo HTTP apropiado
app.use(errorHandler);

export default app;
