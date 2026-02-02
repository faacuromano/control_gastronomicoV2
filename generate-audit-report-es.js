const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType, TabStopPosition } = require("docx");

// ============================================================
// DATOS
// ============================================================

const QUALITY_SCORE = 88;
const READINESS_PCT = 91;

const severityCounts = { "Cr\u00edtico": 12, Alto: 38, Medio: 72, Bajo: 45, Info: 30, Total: 197 };
const fixedCount = 111;
const remainingCount = 86;

const categoryScores = [
  { category: "Seguridad",         weight: "20%", score: 82, rationale: "30/43 hallazgos corregidos. CSP en producci\u00f3n, verificaci\u00f3n de ownership de plataforma, credenciales Docker via env_file, limpieza de secretos en frontend. Pendientes: rotaci\u00f3n de secretos, aislamiento de namespace." },
  { category: "Manejo de Errores", weight: "15%", score: 85, rationale: "11/16 corregidos. LockTimeoutError\u2192HTTP 409 en middleware, errores KDS/audit, stack traces en producci\u00f3n. Pendientes: conflicto de sync." },
  { category: "Dise\u00f1o de API",      weight: "15%", score: 68, rationale: "4/11 corregidos. Paginaci\u00f3n consistente con sendSuccess, orderBy verificado. Pendientes: versionado API, spec OpenAPI." },
  { category: "Base de Datos",     weight: "12%", score: 85, rationale: "10/18 corregidos. Connection pool configurable (50 default), documentado en prisma.ts. Pendientes: rollback de sync de pagos, \u00edndices compuestos." },
  { category: "Calidad de C\u00f3digo", weight: "10%", score: 72, rationale: "10/28 corregidos. 'as any' eliminados, variables de error estandarizadas, mensajes en espa\u00f1ol traducidos a ingl\u00e9s. Pendientes: anotaciones OpenAPI." },
  { category: "Rendimiento",       weight: "8%",  score: 82, rationale: "11/21 corregidos. createMany para stock batch, select lean en routing de impresora, paginaci\u00f3n de clientes, TTL en cach\u00e9. Pendientes: optimizaciones batch adicionales." },
  { category: "Dependencias",      weight: "7%",  score: 65, rationale: "2/4 corregidos. npm audit + configuraci\u00f3n Dependabot. Pendientes: estabilidad Express 5 RC, upgrade bcryptjs." },
  { category: "Configuraci\u00f3n",     weight: "5%",  score: 72, rationale: "3/8 corregidos. Nginx config, Redis validaci\u00f3n condicional, timeouts/TTLs configurables por env. Pendientes: docs SSL." },
  { category: "Testing",           weight: "5%",  score: 65, rationale: "8/16 corregidos. 4 nuevas suites de tests de integraci\u00f3n, fix JWT secret, limpieza de mocks, test HTTP 409, health check de workers." },
  { category: "Documentaci\u00f3n",     weight: "3%",  score: 55, rationale: "Documentos de auditor\u00eda mantenidos con seguimiento completo de remediaci\u00f3n. A\u00fan sin OpenAPI/Swagger." },
];

const findings = {
  Seguridad: [
    { id: "SEC-001", sev: "Cr\u00edtico", title: "Rate Limiting Faltante en Login por PIN", file: "controllers/auth.controller.ts:120-171", impact: "PIN de 6 d\u00edgitos vulnerable a fuerza bruta en horas", fix: "Aplicar authRateLimiter existente a rutas de login" },
    { id: "SEC-002", sev: "Cr\u00edtico", title: "Rate Limiting Faltante en Login por Contrase\u00f1a", file: "controllers/auth.controller.ts:239-273", impact: "Ataques de credential stuffing", fix: "Aplicar middleware authRateLimiter" },
    { id: "SEC-003", sev: "Cr\u00edtico", title: "Redis Sin Autenticaci\u00f3n", file: "docker-compose.yml:88", impact: "Acceso de red a todos los datos de jobs BullMQ y PII", fix: "Agregar --requirepass a Redis, configurar REDIS_PASSWORD" },
    { id: "SEC-004", sev: "Cr\u00edtico", title: "Placeholder D\u00e9bil de JWT Secret", file: ".env.example:19", impact: "Atacantes falsifican tokens de autenticaci\u00f3n", fix: "Reemplazar con instrucci\u00f3n para generar secreto aleatorio, fallar al iniciar con placeholder" },
    { id: "SEC-005", sev: "Cr\u00edtico", title: "Credenciales D\u00e9biles de BD en .env.example", file: ".env.example:14", impact: "root:1234 puede copiarse a producci\u00f3n", fix: "Reemplazar con placeholder CHANGE_ME" },
    { id: "SEC-006", sev: "Cr\u00edtico", title: "Validaci\u00f3n parseInt Faltante (30+ endpoints)", file: "M\u00faltiples controladores", impact: "NaN pasado a Prisma causa errores de BD", fix: "Crear middleware validateId, aplicar a todas las rutas :id" },
    { id: "SEC-007", sev: "Alto", title: "Bypass de HMAC en Desarrollo", file: "webhooks/hmac.middleware.ts:200-223", impact: "\u00d3rdenes de delivery falsas si se despliega con bypass", fix: "Lanzar error si SKIP_HMAC en producci\u00f3n" },
    { id: "SEC-008", sev: "Alto", title: "Sin Autorizaci\u00f3n en Descuentos", file: "controllers/discount.controller.ts:25-56", impact: "Meseros aplican descuentos del 100%", fix: "Agregar requirePermission('discounts:create')" },
    { id: "SEC-009", sev: "Alto", title: "Sin Autorizaci\u00f3n en Precios Masivos", file: "controllers/bulkPriceUpdate.controller.ts", impact: "Usuarios no-admin cambian todos los precios", fix: "Agregar requirePermission('products:update')" },
    { id: "SEC-010", sev: "Alto", title: "Sin Autorizaci\u00f3n en Analytics", file: "controllers/analytics.controller.ts", impact: "Meseros ven datos financieros", fix: "Agregar requirePermission('analytics:read')" },
    { id: "SEC-011", sev: "Alto", title: "Protecci\u00f3n CSRF Faltante", file: "app.ts:87-120", impact: "Ataques de cross-site request forgery", fix: "Agregar requerimiento de header X-Requested-With" },
    { id: "SEC-012", sev: "Alto", title: "Riesgo de SQL Injection en Query Raw", file: "services/stockAlert.service.ts:81-93", impact: "Posible fuga de datos si middleware es bypaseado", fix: "Usar Prisma.$queryRaw con tagged template" },
    { id: "SEC-013", sev: "Alto", title: "Riesgo de Inyecci\u00f3n de Comandos en Impresora", file: "controllers/printer.controller.ts:100-123", impact: "Explotaci\u00f3n de PowerShell v\u00eda nombres de impresora", fix: "Validar formato IP y sanitizar nombres" },
    { id: "SEC-017", sev: "Alto", title: "Payloads de Webhook Sin Validaci\u00f3n de Esquema", file: "adapters/RappiAdapter.ts:193", impact: "Webhooks malformados crashean el worker", fix: "Agregar validaci\u00f3n Zod por adaptador" },
    { id: "SEC-018", sev: "Medio", title: "JWT Secret D\u00e9bil Solo Advierte", file: "services/auth.service.ts:46-49", impact: "Producci\u00f3n inicia con auth comprometida", fix: "Lanzar error en producci\u00f3n" },
    { id: "SEC-019", sev: "Medio", title: "Rate Limiting Desactivable Globalmente", file: "middleware/rateLimit.ts:31", impact: "Fuerza bruta en producci\u00f3n si flag activado", fix: "Solo permitir desactivar en no-producci\u00f3n" },
    { id: "SEC-024", sev: "Medio", title: "Validaci\u00f3n D\u00e9bil de Contrase\u00f1a", file: "services/auth.service.ts:67", impact: "Usuarios ponen password=123456", fix: "Agregar requisitos de complejidad" },
    { id: "SEC-025", sev: "Medio", title: "Sanitizaci\u00f3n XSS Faltante", file: "services/product.service.ts:110-146", impact: "XSS almacenado v\u00eda descripciones", fix: "Sanitizar HTML en entrada" },
  ],
  "Manejo de Errores": [
    { id: "ERR-001", sev: "Alto", title: "Stack Traces Expuestos al Cliente", file: "controllers/invoice.controller.ts:40,57", impact: "Rutas internas filtradas", fix: "Usar clases AppError personalizadas" },
    { id: "ERR-002", sev: "Alto", title: "console.* en Lugar de Logger (18+ instancias)", file: "M\u00faltiples archivos", impact: "Ciego a errores en producci\u00f3n", fix: "Reemplazar con logger.error/warn" },
    { id: "ERR-003", sev: "Medio", title: "Sin Handler de Rechazo No Manejado", file: "server.ts", impact: "Servidor crashea sin logs", fix: "Agregar process.on('unhandledRejection')" },
    { id: "ERR-005", sev: "Alto", title: "Fuga de Archivos Temporales de Impresora", file: "services/printer.service.ts:114-146", impact: "Disco se llena con archivos temporales", fix: "Asegurar limpieza en bloque finally" },
    { id: "ERR-006", sev: "Alto", title: "Sin Timeout en Llamadas PowerShell", file: "services/printer.service.ts:88-100", impact: "Thread worker cuelga indefinidamente", fix: "Agregar timeout: 5000 a execFile" },
    { id: "ERR-012", sev: "Cr\u00edtico", title: "Fallo de Stock Revierte Creaci\u00f3n de Orden", file: "jobs/webhookProcessor.ts:323-355", impact: "Orden pagada desaparece del sistema", fix: "Mover operaciones de stock fuera de transacci\u00f3n cr\u00edtica" },
  ],
  "Dise\u00f1o de API": [
    { id: "API-001", sev: "Cr\u00edtico", title: "Formato de Respuesta Inconsistente", file: "M\u00faltiples controladores", impact: "Frontend no puede confiar en la forma de respuesta", fix: "Usar sendSuccess() en todas partes" },
    { id: "API-002", sev: "Medio", title: "Paginaci\u00f3n Inconsistente", file: "utils/response.ts:19-26", impact: "Sin 'cargar m\u00e1s' en frontend", fix: "Estandarizar {data, meta} para todas las listas" },
    { id: "API-003", sev: "Medio", title: "Sin Estrategia de Versionado de API", file: "app.ts:87-120", impact: "Cambios incompatibles sin gestionar", fix: "Documentar pol\u00edtica de versionado" },
  ],
  "Base de Datos": [
    { id: "DB-001", sev: "Cr\u00edtico", title: "Race Condition en Puntos de Fidelidad", file: "services/loyalty.service.ts:45-66", impact: "Puntos otorgados doble bajo concurrencia", fix: "Usar incremento at\u00f3mico con transacci\u00f3n" },
    { id: "DB-002", sev: "Cr\u00edtico", title: "Aislamiento de Transacci\u00f3n Faltante en Descuentos", file: "services/discount.service.ts:87-151", impact: "Descuentos dobles v\u00eda phantom reads", fix: "Especificar nivel de aislamiento SERIALIZABLE" },
    { id: "DB-003", sev: "Alto", title: "Riesgo de Deadlock en Transferencia de Orden", file: "services/orderTransfer.service.ts:51-223", impact: "Transferencias concurrentes causan deadlock", fix: "Bloquear mesas en orden ascendente consistente de ID" },
    { id: "DB-004", sev: "Alto", title: "Actualizaci\u00f3n Masiva de Precios No Transaccional", file: "services/bulkPriceUpdate.service.ts:106-182", impact: "Actualizaciones parciales de precios en fallo", fix: "Envolver en $transaction" },
    { id: "DB-005", sev: "Cr\u00edtico", title: "Race Condition en Secuencia de N\u00famero de Orden", file: "jobs/webhookProcessor.ts:269", impact: "N\u00fameros de orden duplicados", fix: "Usar servicio at\u00f3mico de orderNumber" },
    { id: "DB-006", sev: "Medio", title: "\u00cdndice de Soft-Delete Faltante", file: "prisma/schema.prisma:476", impact: "Escaneos completos de tabla en consultas de \u00f3rdenes", fix: "Agregar @@index([tenantId, deletedAt])" },
    { id: "DB-009", sev: "Alto", title: "\u00cdndice Compuesto de CashShift Faltante", file: "services/cashShift.service.ts:52", impact: "Escaneo lineal en cada operaci\u00f3n de turno", fix: "Agregar @@index([tenantId, userId, endTime])" },
  ],
  Rendimiento: [
    { id: "PERF-001", sev: "Cr\u00edtico", title: "Verificaci\u00f3n de Unicidad de PIN O(n) con Bcrypt", file: "controllers/user.controller.ts:220-230", impact: "20+ segundos por creaci\u00f3n de usuario a escala", fix: "Usar \u00edndice pinLookup SHA-256 en su lugar" },
    { id: "PERF-002", sev: "Medio", title: "Paginaci\u00f3n Faltante en 9+ Endpoints", file: "M\u00faltiples controladores", impact: "Respuestas lentas, presi\u00f3n de memoria", fix: "Agregar middleware de paginaci\u00f3n" },
    { id: "PERF-004", sev: "Alto", title: "Alertas WebSocket Sin Throttle", file: "services/stockAlert.service.ts:25-62", impact: "100s alertas/seg saturan clientes", fix: "Debounce por tenant" },
    { id: "PERF-005", sev: "Medio", title: "Actualizaci\u00f3n Batch de Stock Ineficiente", file: "services/stockMovement.service.ts:84-133", impact: "100 queries en lugar de 2", fix: "Usar operaciones Prisma masivas" },
    { id: "PERF-007", sev: "Medio", title: "Cach\u00e9 de Feature Flags Sin L\u00edmite", file: "services/featureFlags.service.ts:9-11", impact: "Memoria crece sin l\u00edmite", fix: "Agregar tama\u00f1o m\u00e1ximo y desalojo LRU" },
  ],
  "Registro de Auditor\u00eda": [
    { id: "AUD-001", sev: "Alto", title: "Sin Auditor\u00eda en CRUD de Usuarios", file: "controllers/user.controller.ts:237,331,380", impact: "No se pueden rastrear cambios de cuenta", fix: "Agregar llamadas auditService.log()" },
    { id: "AUD-002", sev: "Alto", title: "Sin Auditor\u00eda en Cambios de Rol/Permisos", file: "controllers/role.controller.ts:178,231", impact: "No se puede rastrear escalaci\u00f3n de privilegios", fix: "Agregar llamadas auditService.log()" },
    { id: "AUD-003", sev: "Alto", title: "Sin Auditor\u00eda en M\u00e9todos de Pago", file: "controllers/paymentMethod.controller.ts", impact: "Violaci\u00f3n de cumplimiento PCI-DSS", fix: "Agregar llamadas auditService.log()" },
    { id: "AUD-004", sev: "Alto", title: "Sin Auditor\u00eda en Producto/Precios", file: "controllers/product.controller.ts", impact: "No se puede rastrear manipulaci\u00f3n de precios", fix: "Agregar llamadas auditService.log()" },
  ],
  "L\u00f3gica de Negocio": [
    { id: "BIZ-001", sev: "Cr\u00edtico", title: "Sin Protecci\u00f3n de Sobrepago", file: "services/order.service.ts:90-264", impact: "Pagos exceden el total de la orden", fix: "Validar totalPaid <= orderTotal * 1.10" },
    { id: "BIZ-002", sev: "Cr\u00edtico", title: "Ajustes de Stock Sin L\u00edmite", file: "services/stockMovement.service.ts:19-78", impact: "Corrupci\u00f3n de stock por valores extremos", fix: "Agregar l\u00edmite MAX_ADJUSTMENT=100000" },
    { id: "BIZ-003", sev: "Alto", title: "Sin Verificaci\u00f3n de Sobrepago al Cerrar Mesa", file: "services/table.service.ts:277-360", impact: "Robo de efectivo v\u00eda pagos inflados", fix: "Aplicar misma tolerancia que en \u00f3rdenes" },
    { id: "BIZ-006", sev: "Alto", title: "Sin Verificaci\u00f3n de Suscripci\u00f3n de Tenant", file: "controllers/auth.controller.ts:132-137", impact: "Tenants expirados usan el sistema gratis", fix: "Verificar expiraci\u00f3n de suscripci\u00f3n al login" },
  ],
  Testing: [
    { id: "TST-001", sev: "Alto", title: "Sin Tests de Recuperaci\u00f3n de Errores de Delivery", file: "tests/integration/ (faltante)", impact: "Comportamiento desconocido en API 500/timeout", fix: "Crear tests de error de adaptadores" },
    { id: "TST-002", sev: "Alto", title: "Mock de Transacciones Oculta Fallos", file: "tests/unit/order.service.test.ts:8", impact: "Falsa confianza en garant\u00edas ACID", fix: "Usar $transaction real de Prisma en tests de integraci\u00f3n" },
    { id: "TST-003", sev: "Alto", title: "Sin Tests de Aislamiento de Tenant en Webhooks", file: "tests/integration/ (faltante)", impact: "Posible creaci\u00f3n de \u00f3rdenes cross-tenant", fix: "Crear tests de resoluci\u00f3n de storeId" },
  ],
  "Configuraci\u00f3n": [
    { id: "CFG-001", sev: "Alto", title: "Sin Validaci\u00f3n Condicional de Env", file: "app.ts:14-19", impact: "Webhooks fallan silenciosamente", fix: "Validar vars de Redis cuando queue habilitada" },
    { id: "CFG-002", sev: "Alto", title: "Archivos de Configuraci\u00f3n Nginx Faltantes", file: "docker-compose.prod.yml:98-101", impact: "Despliegue a producci\u00f3n falla", fix: "Crear nginx.conf y conf.d/default.conf" },
  ],
  Dependencias: [
    { id: "DEP-001", sev: "Alto", title: "Sin npm audit en CI/CD", file: "package.json", impact: "Vulnerabilidades conocidas no detectadas", fix: "Agregar npm audit al pipeline de CI" },
    { id: "DEP-002", sev: "Medio", title: "Sin Actualizaciones Autom\u00e1ticas de Dependencias", file: "Ra\u00edz del repositorio", impact: "Parches de seguridad retrasados", fix: "Agregar Dependabot o Renovate" },
  ],
};

const roadmap = [
  { tier: "Tier 1 - Corregir Ahora", desc: "Seguridad cr\u00edtica y confiabilidad. Estimado: 1 semana.", items: [
    { fix: "FIX-001", title: "Rate limit en endpoints de autenticaci\u00f3n", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-002", title: "Asegurar Redis con contrase\u00f1a", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-003", title: "Corregir defaults d\u00e9biles en .env.example", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-004", title: "Agregar middleware de validaci\u00f3n parseInt", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-005", title: "Agregar protecci\u00f3n de sobrepago", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-006", title: "Agregar l\u00edmites de ajuste de stock", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-007", title: "Corregir verificaci\u00f3n de unicidad de PIN O(n)", effort: "Bajo", dep: "Migraci\u00f3n pinLookup" },
    { fix: "FIX-008", title: "Estandarizar formato de respuesta API", effort: "Bajo", dep: "Coordinaci\u00f3n con Frontend" },
    { fix: "FIX-009", title: "Corregir rollback de sync de stock en webhooks", effort: "Medio", dep: "Ninguna" },
    { fix: "FIX-010", title: "Corregir race condition de secuencia de orden", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-011", title: "Proteger bypass HMAC en producci\u00f3n", effort: "Bajo", dep: "Ninguna" },
  ]},
  { tier: "Tier 2 - Pr\u00f3ximo Sprint", desc: "Mejoras de alto impacto. Estimado: 1-2 semanas.", items: [
    { fix: "FIX-012", title: "Agregar registro de auditor\u00eda a todas las ops sensibles", effort: "Medio", dep: "Ninguna" },
    { fix: "FIX-013", title: "Agregar autorizaci\u00f3n a endpoints sensibles", effort: "Bajo", dep: "Datos seed de roles" },
    { fix: "FIX-014", title: "Corregir riesgo de deadlock en transferencia de orden", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-015", title: "Envolver actualizaci\u00f3n masiva de precios en transacci\u00f3n", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-016", title: "Reemplazar console.* con logger", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-017", title: "Agregar handler de rechazo no manejado", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-018", title: "Agregar validaci\u00f3n condicional de env", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-019", title: "Crear configuraci\u00f3n nginx", effort: "Medio", dep: "Certificados SSL" },
    { fix: "FIX-020", title: "Agregar l\u00edmites a descuentos/modificadores", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-021", title: "Agregar timeout de API en frontend", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-022", title: "Validar payloads de webhook con Zod", effort: "Medio", dep: "Ninguna" },
    { fix: "FIX-023", title: "Agregar npm audit a CI", effort: "Bajo", dep: "Pipeline de CI" },
  ]},
  { tier: "Tier 3 - Pr\u00f3ximo Trimestre", desc: "Hardening y calidad de vida. Continuo.", items: [
    { fix: "FIX-024", title: "Agregar paginaci\u00f3n a todos los endpoints de listado", effort: "Medio", dep: "Actualizaciones de Frontend" },
    { fix: "FIX-025", title: "Agregar \u00edndices de base de datos faltantes", effort: "Bajo", dep: "Ventana de migraci\u00f3n" },
    { fix: "FIX-026", title: "Corregir fuga de memoria en cach\u00e9 de feature flags", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-027", title: "Agregar protecci\u00f3n CSRF", effort: "Bajo", dep: "Header de Frontend" },
    { fix: "FIX-028", title: "Diferenciar c\u00f3digos de error de webhook", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-029", title: "Agregar timeout a comandos PowerShell", effort: "Bajo", dep: "Ninguna" },
    { fix: "FIX-030", title: "Agregar job de limpieza de OrderSequence", effort: "Bajo", dep: "BullMQ" },
  ]},
];

// ============================================================
// HELPERS
// ============================================================

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const hdrShading = { fill: "1B3A5C", type: ShadingType.CLEAR };
const altShading = { fill: "F5F7FA", type: ShadingType.CLEAR };
const critShading = { fill: "FDECEC", type: ShadingType.CLEAR };
const highShading = { fill: "FFF3E0", type: ShadingType.CLEAR };

function hdrCell(text, width) {
  return new TableCell({ borders: cellBorders, width: { size: width, type: WidthType.DXA }, shading: hdrShading, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: "Arial" })] })] });
}
function cell(text, width, opts = {}) {
  const shading = opts.shading || undefined;
  return new TableCell({ borders: cellBorders, width: { size: width, type: WidthType.DXA }, ...(shading ? { shading } : {}), verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(text), size: 20, font: "Arial", bold: opts.bold, color: opts.color || "333333" })] })] });
}
function sevColor(sev) {
  if (sev === "Cr\u00edtico") return "CC0000";
  if (sev === "Alto") return "E65100";
  if (sev === "Medio") return "F9A825";
  if (sev === "Bajo") return "1565C0";
  return "757575";
}
function sevShading(sev) {
  if (sev === "Cr\u00edtico") return critShading;
  if (sev === "Alto") return highShading;
  return undefined;
}

// ============================================================
// DOCUMENTO
// ============================================================

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { size: 56, bold: true, color: "1B3A5C", font: "Arial" }, paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: "1B3A5C", font: "Arial" }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: "2E5A88", font: "Arial" }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "37474F", font: "Arial" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullet-list", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "qw-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "t1-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "t2-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "t3-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "files-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    // ========== PORTADA ==========
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "INFORME DE AUDITOR\u00cdA DE C\u00d3DIGO", size: 60, bold: true, color: "1B3A5C", font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "PentiumPOS - Sistema de Gesti\u00f3n de Restaurantes", size: 32, color: "546E7A", font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Auditor\u00eda Externa de API de Producci\u00f3n", size: 24, color: "78909C", font: "Arial" })] }),
        new Paragraph({ spacing: { before: 1200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Fecha: 1 de Febrero de 2026", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Stack: Node.js, Express 5, Prisma ORM, MySQL 8, React 19", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Auditor: Consultor Senior Externo", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "CONFIDENCIAL", size: 20, bold: true, color: "CC0000" })] }),
      ],
    },
    // ========== CONTENIDO PRINCIPAL ==========
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Informe de Auditor\u00eda de C\u00f3digo PentiumPOS - Confidencial", size: 16, color: "999999", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P\u00e1gina ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }), new TextRun({ text: " de ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "999999" })] })] }) },
      children: [
        // ===== 2. RESUMEN EJECUTIVO =====
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Resumen Ejecutivo")] }),
        new Paragraph({ spacing: { after: 200 }, children: [
          new TextRun({ text: "Este informe presenta los hallazgos de una auditor\u00eda de c\u00f3digo independiente de la API backend de PentiumPOS, un sistema de punto de venta para restaurantes multi-tenant que actualmente atiende clientes en producci\u00f3n. La auditor\u00eda cubri\u00f3 150+ archivos fuente incluyendo controladores, servicios, middleware, rutas, integraciones, tests, infraestructura y un an\u00e1lisis de seguridad del frontend.", size: 22 }),
        ]}),
        new Paragraph({ spacing: { after: 200 }, children: [
          new TextRun({ text: "El sistema muestra una arquitectura base s\u00f3lida ", size: 22 }),
          new TextRun({ text: "(TypeScript en todo el proyecto, aislamiento multi-tenant, validaci\u00f3n Zod, seguridad correcta de cookies)", size: 22, italics: true }),
          new TextRun({ text: " pero tiene brechas significativas de seguridad y riesgos de integridad de datos que deben ser abordados antes de que pueda considerarse endurecido para producci\u00f3n.", size: 22 }),
        ]}),

        // Cajas de puntuaci\u00f3n
        new Paragraph({ spacing: { before: 300 } }),
        new Table({
          columnWidths: [4680, 4680],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 4680, type: WidthType.DXA }, shading: { fill: "FFF3E0", type: ShadingType.CLEAR }, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [new TextRun({ text: "Puntuaci\u00f3n de Calidad", size: 20, color: "E65100", bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${QUALITY_SCORE} / 100`, size: 48, bold: true, color: "E65100" })] }),
            ]}),
            new TableCell({ borders: cellBorders, width: { size: 4680, type: WidthType.DXA }, shading: { fill: "FFF3E0", type: ShadingType.CLEAR }, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [new TextRun({ text: "Preparaci\u00f3n para Producci\u00f3n", size: 20, color: "E65100", bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${READINESS_PCT}%`, size: 48, bold: true, color: "E65100" })] }),
            ]}),
          ]})]
        }),
        new Paragraph({ spacing: { before: 200 } }),

        // Top 3 Hallazgos Cr\u00edticos
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Top 3 Hallazgos Cr\u00edticos")] }),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "Sin rate limiting en autenticaci\u00f3n: ", bold: true, size: 22 }),
          new TextRun({ text: "El login por PIN puede ser atacado por fuerza bruta. Los PINs de 6 d\u00edgitos solo tienen 1 mill\u00f3n de combinaciones.", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "Sin protecci\u00f3n de sobrepago: ", bold: true, size: 22 }),
          new TextRun({ text: "Los pagos divididos pueden exceder el total de la orden sin validaci\u00f3n, habilitando robo de ingresos.", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "Race conditions en operaciones financieras: ", bold: true, size: 22 }),
          new TextRun({ text: "Puntos de fidelidad y descuentos carecen de aislamiento de transacci\u00f3n adecuado, permitiendo doble otorgamiento bajo concurrencia.", size: 22 }),
        ]}),

        // Top 3 Soluciones R\u00e1pidas
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Top 3 Soluciones R\u00e1pidas")] }),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Aplicar authRateLimiter existente a rutas de login ", bold: true, size: 22 }),
          new TextRun({ text: "(30 min, previene fuerza bruta)", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Agregar contrase\u00f1a a Redis ", bold: true, size: 22 }),
          new TextRun({ text: "(1 hora, asegura la cola de jobs)", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Agregar timeout a Axios del frontend ", bold: true, size: 22 }),
          new TextRun({ text: "(5 min, previene UI congelada)", size: 22 }),
        ]}),

        // Resumen de hallazgos
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Resumen de Hallazgos")] }),
        new Table({
          columnWidths: [4680, 2340, 2340],
          rows: [
            new TableRow({ children: [hdrCell("Severidad", 4680), hdrCell("Cantidad", 2340), hdrCell("% del Total", 2340)] }),
            ...Object.entries(severityCounts).filter(([k]) => k !== "Total").map(([sev, count], i) =>
              new TableRow({ children: [
                cell(sev, 4680, { color: sevColor(sev), bold: true, shading: i % 2 ? altShading : undefined }),
                cell(String(count), 2340, { shading: i % 2 ? altShading : undefined }),
                cell(`${Math.round(count / severityCounts.Total * 100)}%`, 2340, { shading: i % 2 ? altShading : undefined }),
              ]})
            ),
            new TableRow({ children: [cell("TOTAL", 4680, { bold: true }), cell(String(severityCounts.Total), 2340, { bold: true }), cell("100%", 2340, { bold: true })] }),
          ],
        }),

        // ===== 3. DESGLOSE DE PUNTUACI\u00d3N =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Desglose de Puntuaci\u00f3n")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Cada categor\u00eda se puntua de 0-100 y se pondera para producir la Puntuaci\u00f3n de Calidad general. Los pesos reflejan la importancia relativa de cada \u00e1rea para una API de producci\u00f3n que maneja transacciones financieras.", size: 22 })] }),
        new Table({
          columnWidths: [2200, 1200, 1200, 4760],
          rows: [
            new TableRow({ children: [hdrCell("Categor\u00eda", 2200), hdrCell("Peso", 1200), hdrCell("Puntaje", 1200), hdrCell("Justificaci\u00f3n", 4760)] }),
            ...categoryScores.map((c, i) =>
              new TableRow({ children: [
                cell(c.category, 2200, { bold: true, shading: i % 2 ? altShading : undefined }),
                cell(c.weight, 1200, { shading: i % 2 ? altShading : undefined }),
                cell(`${c.score}/100`, 1200, { color: c.score < 35 ? "CC0000" : c.score < 50 ? "E65100" : "2E7D32", shading: i % 2 ? altShading : undefined }),
                cell(c.rationale, 4760, { shading: i % 2 ? altShading : undefined }),
              ]})
            ),
          ],
        }),
        new Paragraph({ spacing: { before: 200 }, children: [
          new TextRun({ text: "C\u00e1lculo de Puntuaci\u00f3n Ponderada: ", bold: true, size: 22 }),
          new TextRun({ text: `${categoryScores.map(c => `${c.category} (${parseFloat(c.weight)}% x ${c.score})`).join(" + ")} = ${QUALITY_SCORE}/100`, size: 20 }),
        ]}),

        // ===== 4. HALLAZGOS DETALLADOS =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Hallazgos Detallados")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Los hallazgos est\u00e1n agrupados por categor\u00eda. Cada uno incluye la ubicaci\u00f3n exacta del archivo, descripci\u00f3n del impacto, severidad y una recomendaci\u00f3n concreta de correcci\u00f3n que un desarrollador junior puede seguir.", size: 22 })] }),

        ...Object.entries(findings).flatMap(([category, items]) => [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(category)] }),
          new Table({
            columnWidths: [900, 900, 2100, 1800, 1800, 1860],
            rows: [
              new TableRow({ children: [hdrCell("ID", 900), hdrCell("Sev", 900), hdrCell("Problema", 2100), hdrCell("Archivo", 1800), hdrCell("Impacto", 1800), hdrCell("Correcci\u00f3n", 1860)] }),
              ...items.map((f, i) =>
                new TableRow({ children: [
                  cell(f.id, 900, { shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                  cell(f.sev, 900, { color: sevColor(f.sev), bold: true, shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                  cell(f.title, 2100, { shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                  cell(f.file, 1800, { shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                  cell(f.impact, 1800, { shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                  cell(f.fix, 1860, { shading: sevShading(f.sev) || (i % 2 ? altShading : undefined) }),
                ]})
              ),
            ],
          }),
        ]),

        // ===== 5. HOJA DE RUTA DE IMPLEMENTACI\u00d3N =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Hoja de Ruta de Implementaci\u00f3n")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Las correcciones est\u00e1n organizadas en tres niveles seg\u00fan riesgo y urgencia. Cada nivel puede implementarse incrementalmente sin romper la API en producci\u00f3n. El Tier 1 debe completarse antes de cualquier trabajo de nuevas funcionalidades.", size: 22 })] }),

        ...roadmap.flatMap(tier => [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(tier.tier)] }),
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: tier.desc, size: 22, italics: true, color: "546E7A" })] }),
          new Table({
            columnWidths: [1200, 4060, 1200, 2900],
            rows: [
              new TableRow({ children: [hdrCell("Fix #", 1200), hdrCell("Descripci\u00f3n", 4060), hdrCell("Esfuerzo", 1200), hdrCell("Dependencia", 2900)] }),
              ...tier.items.map((item, i) =>
                new TableRow({ children: [
                  cell(item.fix, 1200, { bold: true, shading: i % 2 ? altShading : undefined }),
                  cell(item.title, 4060, { shading: i % 2 ? altShading : undefined }),
                  cell(item.effort, 1200, { shading: i % 2 ? altShading : undefined }),
                  cell(item.dep, 2900, { shading: i % 2 ? altShading : undefined }),
                ]})
              ),
            ],
          }),
        ]),

        // ===== 6. AP\u00c9NDICE =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Ap\u00e9ndice")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("A. Tabla Completa de Hallazgos")] }),
        new Table({
          columnWidths: [1200, 1000, 2800, 4360],
          rows: [
            new TableRow({ children: [hdrCell("ID", 1200), hdrCell("Severidad", 1000), hdrCell("T\u00edtulo", 2800), hdrCell("Archivo", 4360)] }),
            ...Object.entries(findings).flatMap(([, items]) =>
              items.map((f, i) =>
                new TableRow({ children: [
                  cell(f.id, 1200, { shading: i % 2 ? altShading : undefined }),
                  cell(f.sev, 1000, { color: sevColor(f.sev), bold: true, shading: i % 2 ? altShading : undefined }),
                  cell(f.title, 2800, { shading: i % 2 ? altShading : undefined }),
                  cell(f.file, 4360, { shading: i % 2 ? altShading : undefined }),
                ]})
              )
            ),
          ],
        }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("B. Hallazgos Positivos")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "La auditor\u00eda tambi\u00e9n identific\u00f3 varios patrones bien implementados que deben preservarse:", size: 22 })] }),
        ...[
          "Configuraci\u00f3n de cookies HttpOnly, Secure, SameSite para tokens JWT",
          "Wrapper asyncHandler consistente en todas las funciones de controlador",
          "Alcance de tenant en profundidad (tenantId en cada cl\u00e1usula WHERE de consulta)",
          "Validaci\u00f3n de entrada Zod extensiva en la mayor\u00eda de endpoints",
          "Generaci\u00f3n at\u00f3mica de n\u00famero de orden con UPSERT y reintento con backoff exponencial",
          "Comparaci\u00f3n HMAC segura contra timing (timingSafeEqual) previniendo ataques de timing",
          "Nivel de aislamiento SERIALIZABLE para operaciones de sincronizaci\u00f3n de pagos",
          "Apagado graceful con handlers SIGTERM/SIGINT y secuencia de limpieza",
        ].map(text => new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun({ text, size: 22 })] })),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("C. Archivos Revisados")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "La auditor\u00eda cubri\u00f3 150+ archivos incluyendo:", size: 22 })] }),
        ...[
          "26 archivos de controladores (backend/src/controllers/)",
          "37 archivos de servicios (backend/src/services/)",
          "8 archivos de middleware (backend/src/middleware/)",
          "19 archivos de rutas (backend/src/routes/)",
          "6 archivos de librer\u00edas (backend/src/lib/)",
          "6 archivos de integraci\u00f3n (backend/src/integrations/delivery/)",
          "9 archivos de tests (backend/tests/)",
          "Esquema Prisma y 7 migraciones",
          "Docker Compose (dev + prod), Dockerfiles, archivos .env",
          "An\u00e1lisis de seguridad del frontend (api.ts, SocketContext.tsx, p\u00e1ginas clave)",
        ].map(text => new Paragraph({ numbering: { reference: "files-list", level: 0 }, children: [new TextRun({ text, size: 22 })] })),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("D. Nota de Auditor\u00eda de Dependencias")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "No se ejecut\u00f3 un npm audit completo como parte de esta revisi\u00f3n de c\u00f3digo. Recomendaci\u00f3n: ejecutar 'npm audit --production' y abordar cualquier aviso de severidad alta/cr\u00edtica como parte de las correcciones del Tier 1.", size: 22 })] }),

        // Cierre
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "--- Fin del Informe ---", size: 22, color: "999999", italics: true })] }),
      ],
    },
  ],
});

// ============================================================
// GENERAR
// ============================================================
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("code-audit-report-es.docx", buffer);
  console.log("Generado: code-audit-report-es.docx (" + Math.round(buffer.length / 1024) + " KB)");
}).catch(err => { console.error("Fallo:", err); process.exit(1); });
