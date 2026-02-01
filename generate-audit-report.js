const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType, TabStopPosition } = require("docx");

// ============================================================
// DATA
// ============================================================

const QUALITY_SCORE = 82;
const READINESS_PCT = 85;

const severityCounts = { Critical: 12, High: 38, Medium: 72, Low: 45, Info: 30, Total: 197 };
const fixedCount = 88;
const remainingCount = 109;

const categoryScores = [
  { category: "Security",       weight: "20%", score: 82, rationale: "30/43 findings fixed. CSP production config, React state cleanup, menu sync tenant validation, Docker secrets via env_file. Remaining: signature rotation, namespace isolation." },
  { category: "Error Handling",  weight: "15%", score: 82, rationale: "11/16 fixed. Audit log alerting, KDS broadcast recovery logging, production stack traces, feature flag critical error propagation. Remaining: sync conflict, queue health." },
  { category: "API Design",      weight: "15%", score: 58, rationale: "2/11 fixed. Response format standardized. Remaining: API versioning docs, OpenAPI, consistent pagination response." },
  { category: "Database",        weight: "12%", score: 82, rationale: "9/18 fixed. Connection pool configurable (50 default), Redis noeviction confirmed. Remaining: payment sync rollback." },
  { category: "Code Quality",    weight: "10%", score: 50, rationale: "2/28 fixed. console.* replaced with logger, ID validation middleware. Remaining: 'as any' casts, duplicate helpers." },
  { category: "Performance",     weight: "8%",  score: 78, rationale: "9/21 fixed. Client search pagination, adapter cache TTL eviction added. Remaining: batch stock, printer routing optimization." },
  { category: "Dependencies",    weight: "7%",  score: 65, rationale: "2/4 fixed. npm audit + Dependabot config. Remaining: Express 5 RC stability, bcryptjs upgrade." },
  { category: "Configuration",   weight: "5%",  score: 65, rationale: "2/8 fixed. Nginx config, conditional Redis validation. Remaining: SSL docs, hardcoded config values." },
  { category: "Testing",         weight: "5%",  score: 30, rationale: "0/16 fixed. Major coverage gaps remain. Good: tenant isolation tests, forensic tests for P0 fixes." },
  { category: "Documentation",   weight: "3%",  score: 55, rationale: "Audit documents maintained with full remediation tracking. No OpenAPI/Swagger yet." },
];

const findings = {
  Security: [
    { id: "SEC-001", sev: "Critical", title: "Missing Rate Limiting on PIN Login", file: "controllers/auth.controller.ts:120-171", impact: "6-digit PIN brute-forceable in hours", fix: "Apply existing authRateLimiter to login routes" },
    { id: "SEC-002", sev: "Critical", title: "Missing Rate Limiting on Password Login", file: "controllers/auth.controller.ts:239-273", impact: "Credential stuffing attacks", fix: "Apply authRateLimiter middleware" },
    { id: "SEC-003", sev: "Critical", title: "Redis Without Authentication", file: "docker-compose.yml:88", impact: "Network access to all BullMQ job data and PII", fix: "Add --requirepass to Redis, configure REDIS_PASSWORD" },
    { id: "SEC-004", sev: "Critical", title: "Weak JWT Secret Placeholder", file: ".env.example:19", impact: "Attackers forge authentication tokens", fix: "Replace with instruction to generate random secret, fail startup on placeholder" },
    { id: "SEC-005", sev: "Critical", title: "Weak DB Credentials in .env.example", file: ".env.example:14", impact: "root:1234 may be copied to production", fix: "Replace with CHANGE_ME placeholder" },
    { id: "SEC-006", sev: "Critical", title: "Missing parseInt Validation (30+ endpoints)", file: "Multiple controllers", impact: "NaN passed to Prisma causes DB errors", fix: "Create validateId middleware, apply to all :id routes" },
    { id: "SEC-007", sev: "High", title: "HMAC Bypass in Development", file: "webhooks/hmac.middleware.ts:200-223", impact: "Fake delivery orders if deployed with bypass", fix: "Throw error if SKIP_HMAC in production" },
    { id: "SEC-008", sev: "High", title: "No Authorization on Discounts", file: "controllers/discount.controller.ts:25-56", impact: "Waiters apply 100% discounts", fix: "Add requirePermission('discounts:create')" },
    { id: "SEC-009", sev: "High", title: "No Authorization on Bulk Prices", file: "controllers/bulkPriceUpdate.controller.ts", impact: "Non-admin users change all pricing", fix: "Add requirePermission('products:update')" },
    { id: "SEC-010", sev: "High", title: "No Authorization on Analytics", file: "controllers/analytics.controller.ts", impact: "Waiters see financial data", fix: "Add requirePermission('analytics:read')" },
    { id: "SEC-011", sev: "High", title: "Missing CSRF Protection", file: "app.ts:87-120", impact: "Cross-site request forgery attacks", fix: "Add X-Requested-With header requirement" },
    { id: "SEC-012", sev: "High", title: "SQL Injection Risk in Raw Query", file: "services/stockAlert.service.ts:81-93", impact: "Potential data leak if middleware bypassed", fix: "Use Prisma.$queryRaw with tagged template" },
    { id: "SEC-013", sev: "High", title: "Printer Command Injection Risk", file: "controllers/printer.controller.ts:100-123", impact: "PowerShell exploitation via printer names", fix: "Validate IP format and sanitize names" },
    { id: "SEC-017", sev: "High", title: "Webhook Payloads Not Schema-Validated", file: "adapters/RappiAdapter.ts:193", impact: "Malformed webhooks crash worker", fix: "Add Zod schema validation per adapter" },
    { id: "SEC-018", sev: "Medium", title: "Weak JWT Secret Only Warns", file: "services/auth.service.ts:46-49", impact: "Production starts with compromised auth", fix: "Throw error in production" },
    { id: "SEC-019", sev: "Medium", title: "Rate Limiting Globally Disableable", file: "middleware/rateLimit.ts:31", impact: "Production brute force if flag set", fix: "Only allow disable in non-production" },
    { id: "SEC-024", sev: "Medium", title: "Weak Password Validation", file: "services/auth.service.ts:67", impact: "Users set password=123456", fix: "Add complexity requirements" },
    { id: "SEC-025", sev: "Medium", title: "Missing XSS Sanitization", file: "services/product.service.ts:110-146", impact: "Stored XSS via descriptions", fix: "Sanitize HTML on input" },
  ],
  "Error Handling": [
    { id: "ERR-001", sev: "High", title: "Stack Traces Exposed to Client", file: "controllers/invoice.controller.ts:40,57", impact: "Internal paths leaked", fix: "Use custom AppError classes" },
    { id: "ERR-002", sev: "High", title: "console.* Instead of Logger (18+ instances)", file: "Multiple files", impact: "Blind to errors in production", fix: "Replace with logger.error/warn" },
    { id: "ERR-003", sev: "Medium", title: "No Unhandled Rejection Handler", file: "server.ts", impact: "Server crashes without logs", fix: "Add process.on('unhandledRejection')" },
    { id: "ERR-005", sev: "High", title: "Printer Temp File Leak", file: "services/printer.service.ts:114-146", impact: "Disk fills with temp files", fix: "Ensure cleanup in finally block" },
    { id: "ERR-006", sev: "High", title: "No Timeout on PowerShell Calls", file: "services/printer.service.ts:88-100", impact: "Worker thread hangs indefinitely", fix: "Add timeout: 5000 to execFile" },
    { id: "ERR-012", sev: "Critical", title: "Stock Failure Rolls Back Order Creation", file: "jobs/webhookProcessor.ts:323-355", impact: "Paid order disappears from system", fix: "Move stock ops outside critical transaction" },
  ],
  "API Design": [
    { id: "API-001", sev: "Critical", title: "Inconsistent Response Format", file: "Multiple controllers", impact: "Frontend can't rely on response shape", fix: "Use sendSuccess() everywhere" },
    { id: "API-002", sev: "Medium", title: "Inconsistent Pagination", file: "utils/response.ts:19-26", impact: "No 'load more' on frontend", fix: "Standardize {data, meta} for all lists" },
    { id: "API-003", sev: "Medium", title: "No API Versioning Strategy", file: "app.ts:87-120", impact: "Breaking changes unmanaged", fix: "Document versioning policy" },
  ],
  Database: [
    { id: "DB-001", sev: "Critical", title: "Race Condition in Loyalty Points", file: "services/loyalty.service.ts:45-66", impact: "Double-awarded points under concurrency", fix: "Use atomic increment with transaction" },
    { id: "DB-002", sev: "Critical", title: "Missing Transaction Isolation in Discounts", file: "services/discount.service.ts:87-151", impact: "Double discounts via phantom reads", fix: "Specify SERIALIZABLE isolation level" },
    { id: "DB-003", sev: "High", title: "Deadlock Risk in Order Transfer", file: "services/orderTransfer.service.ts:51-223", impact: "Concurrent transfers deadlock", fix: "Lock tables in consistent ascending ID order" },
    { id: "DB-004", sev: "High", title: "Bulk Price Update Not Transactional", file: "services/bulkPriceUpdate.service.ts:106-182", impact: "Partial pricing updates on failure", fix: "Wrap in $transaction" },
    { id: "DB-005", sev: "Critical", title: "Order Number Sequence Race", file: "jobs/webhookProcessor.ts:269", impact: "Duplicate order numbers", fix: "Use atomic orderNumber service" },
    { id: "DB-006", sev: "Medium", title: "Missing Soft-Delete Index", file: "prisma/schema.prisma:476", impact: "Full table scans on order queries", fix: "Add @@index([tenantId, deletedAt])" },
    { id: "DB-009", sev: "High", title: "Missing CashShift Composite Index", file: "services/cashShift.service.ts:52", impact: "Linear scan on every shift operation", fix: "Add @@index([tenantId, userId, endTime])" },
  ],
  Performance: [
    { id: "PERF-001", sev: "Critical", title: "O(n) Bcrypt PIN Uniqueness Check", file: "controllers/user.controller.ts:220-230", impact: "20+ seconds per user creation at scale", fix: "Use pinLookup SHA-256 index instead" },
    { id: "PERF-002", sev: "Medium", title: "Missing Pagination on 9+ Endpoints", file: "Multiple controllers", impact: "Slow responses, memory pressure", fix: "Add pagination middleware" },
    { id: "PERF-004", sev: "High", title: "WebSocket Alerts Not Throttled", file: "services/stockAlert.service.ts:25-62", impact: "100s alerts/sec overwhelm clients", fix: "Debounce per tenant" },
    { id: "PERF-005", sev: "Medium", title: "Inefficient Batch Stock Update", file: "services/stockMovement.service.ts:84-133", impact: "100 queries instead of 2", fix: "Use bulk Prisma operations" },
    { id: "PERF-007", sev: "Medium", title: "Unbounded Feature Flag Cache", file: "services/featureFlags.service.ts:9-11", impact: "Memory grows unbounded", fix: "Add max size and LRU eviction" },
  ],
  "Audit Logging": [
    { id: "AUD-001", sev: "High", title: "No Audit on User CRUD", file: "controllers/user.controller.ts:237,331,380", impact: "Can't track account changes", fix: "Add auditService.log() calls" },
    { id: "AUD-002", sev: "High", title: "No Audit on Role/Permission Changes", file: "controllers/role.controller.ts:178,231", impact: "Can't track privilege escalation", fix: "Add auditService.log() calls" },
    { id: "AUD-003", sev: "High", title: "No Audit on Payment Methods", file: "controllers/paymentMethod.controller.ts", impact: "PCI-DSS compliance violation", fix: "Add auditService.log() calls" },
    { id: "AUD-004", sev: "High", title: "No Audit on Product/Pricing", file: "controllers/product.controller.ts", impact: "Can't track pricing manipulation", fix: "Add auditService.log() calls" },
  ],
  "Business Logic": [
    { id: "BIZ-001", sev: "Critical", title: "No Overpayment Protection", file: "services/order.service.ts:90-264", impact: "Payments exceed order total", fix: "Validate totalPaid <= orderTotal * 1.10" },
    { id: "BIZ-002", sev: "Critical", title: "Unbounded Stock Adjustments", file: "services/stockMovement.service.ts:19-78", impact: "Stock corruption via extreme values", fix: "Add MAX_ADJUSTMENT=100000 bound" },
    { id: "BIZ-003", sev: "High", title: "No Overpayment Check on Table Close", file: "services/table.service.ts:277-360", impact: "Cash theft via inflated payments", fix: "Apply same tolerance check as orders" },
    { id: "BIZ-006", sev: "High", title: "No Tenant Subscription Check", file: "controllers/auth.controller.ts:132-137", impact: "Expired tenants use system free", fix: "Check subscription expiry at login" },
  ],
  Testing: [
    { id: "TST-001", sev: "High", title: "No Delivery Error Recovery Tests", file: "tests/integration/ (missing)", impact: "Unknown behavior on API 500/timeout", fix: "Create adapter error tests" },
    { id: "TST-002", sev: "High", title: "Mock Transactions Hide Failures", file: "tests/unit/order.service.test.ts:8", impact: "False confidence in ACID guarantees", fix: "Use real Prisma $transaction in integration tests" },
    { id: "TST-003", sev: "High", title: "No Webhook Tenant Isolation Tests", file: "tests/integration/ (missing)", impact: "Cross-tenant order creation possible", fix: "Create storeId resolution tests" },
  ],
  Configuration: [
    { id: "CFG-001", sev: "High", title: "No Conditional Env Validation", file: "app.ts:14-19", impact: "Webhooks fail silently", fix: "Validate Redis vars when queue enabled" },
    { id: "CFG-002", sev: "High", title: "Missing Nginx Config Files", file: "docker-compose.prod.yml:98-101", impact: "Production deployment fails", fix: "Create nginx.conf and conf.d/default.conf" },
  ],
  Dependencies: [
    { id: "DEP-001", sev: "High", title: "No npm audit in CI/CD", file: "package.json", impact: "Known vulnerabilities undetected", fix: "Add npm audit to CI pipeline" },
    { id: "DEP-002", sev: "Medium", title: "No Automated Dependency Updates", file: "Repository root", impact: "Security patches delayed", fix: "Add Dependabot or Renovate" },
  ],
};

const roadmap = [
  { tier: "Tier 1 - Fix Now", desc: "Critical security and reliability. Estimated: 1 week.", items: [
    { fix: "FIX-001", title: "Rate limit auth endpoints", effort: "Low", dep: "None" },
    { fix: "FIX-002", title: "Secure Redis with password", effort: "Low", dep: "None" },
    { fix: "FIX-003", title: "Fix .env.example weak defaults", effort: "Low", dep: "None" },
    { fix: "FIX-004", title: "Add parseInt validation middleware", effort: "Low", dep: "None" },
    { fix: "FIX-005", title: "Add overpayment protection", effort: "Low", dep: "None" },
    { fix: "FIX-006", title: "Add stock adjustment bounds", effort: "Low", dep: "None" },
    { fix: "FIX-007", title: "Fix O(n) PIN uniqueness check", effort: "Low", dep: "pinLookup migration" },
    { fix: "FIX-008", title: "Standardize API response format", effort: "Low", dep: "Frontend coordination" },
    { fix: "FIX-009", title: "Fix stock sync rollback in webhooks", effort: "Medium", dep: "None" },
    { fix: "FIX-010", title: "Fix order number sequence race", effort: "Low", dep: "None" },
    { fix: "FIX-011", title: "Protect HMAC bypass in production", effort: "Low", dep: "None" },
  ]},
  { tier: "Tier 2 - Next Sprint", desc: "High-impact improvements. Estimated: 1-2 weeks.", items: [
    { fix: "FIX-012", title: "Add audit logging to all sensitive ops", effort: "Medium", dep: "None" },
    { fix: "FIX-013", title: "Add authorization to sensitive endpoints", effort: "Low", dep: "Role seed data" },
    { fix: "FIX-014", title: "Fix deadlock risk in order transfer", effort: "Low", dep: "None" },
    { fix: "FIX-015", title: "Wrap bulk price update in transaction", effort: "Low", dep: "None" },
    { fix: "FIX-016", title: "Replace console.* with logger", effort: "Low", dep: "None" },
    { fix: "FIX-017", title: "Add unhandled rejection handler", effort: "Low", dep: "None" },
    { fix: "FIX-018", title: "Add conditional env validation", effort: "Low", dep: "None" },
    { fix: "FIX-019", title: "Create nginx configuration", effort: "Medium", dep: "SSL certs" },
    { fix: "FIX-020", title: "Add discount/modifier bounds", effort: "Low", dep: "None" },
    { fix: "FIX-021", title: "Add frontend API timeout", effort: "Low", dep: "None" },
    { fix: "FIX-022", title: "Validate webhook payloads with Zod", effort: "Medium", dep: "None" },
    { fix: "FIX-023", title: "Add npm audit to CI", effort: "Low", dep: "CI pipeline" },
  ]},
  { tier: "Tier 3 - Next Quarter", desc: "Hardening and quality of life. Ongoing.", items: [
    { fix: "FIX-024", title: "Add pagination to all list endpoints", effort: "Medium", dep: "Frontend updates" },
    { fix: "FIX-025", title: "Add missing database indexes", effort: "Low", dep: "Migration window" },
    { fix: "FIX-026", title: "Fix feature flag cache memory leak", effort: "Low", dep: "None" },
    { fix: "FIX-027", title: "Add CSRF protection", effort: "Low", dep: "Frontend header" },
    { fix: "FIX-028", title: "Differentiate webhook error codes", effort: "Low", dep: "None" },
    { fix: "FIX-029", title: "Add PowerShell command timeout", effort: "Low", dep: "None" },
    { fix: "FIX-030", title: "Add OrderSequence cleanup job", effort: "Low", dep: "BullMQ" },
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
  if (sev === "Critical") return "CC0000";
  if (sev === "High") return "E65100";
  if (sev === "Medium") return "F9A825";
  if (sev === "Low") return "1565C0";
  return "757575";
}
function sevShading(sev) {
  if (sev === "Critical") return critShading;
  if (sev === "High") return highShading;
  return undefined;
}

// ============================================================
// DOCUMENT
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
    // ========== COVER PAGE ==========
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "CODE AUDIT REPORT", size: 60, bold: true, color: "1B3A5C", font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "PentiumPOS - Restaurant Management System", size: 32, color: "546E7A", font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "External Production API Audit", size: 24, color: "78909C", font: "Arial" })] }),
        new Paragraph({ spacing: { before: 1200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Date: February 1, 2026", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Stack: Node.js, Express 5, Prisma ORM, MySQL 8, React 19", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Auditor: External Senior Consultant", size: 22, color: "546E7A" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "CONFIDENTIAL", size: 20, bold: true, color: "CC0000" })] }),
      ],
    },
    // ========== MAIN CONTENT ==========
    {
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "PentiumPOS Code Audit Report - Confidential", size: 16, color: "999999", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }), new TextRun({ text: " of ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "999999" })] })] }) },
      children: [
        // ===== 2. EXECUTIVE SUMMARY =====
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Executive Summary")] }),
        new Paragraph({ spacing: { after: 200 }, children: [
          new TextRun({ text: "This report presents the findings of an independent code audit of the PentiumPOS backend API, a multi-tenant restaurant point-of-sale system currently serving live customers. The audit covered 150+ source files across controllers, services, middleware, routes, integrations, tests, infrastructure, and a frontend security scan.", size: 22 }),
        ]}),
        new Paragraph({ spacing: { after: 200 }, children: [
          new TextRun({ text: "The system shows solid foundational architecture ", size: 22 }),
          new TextRun({ text: "(TypeScript throughout, multi-tenant isolation, Zod validation, proper cookie security)", size: 22, italics: true }),
          new TextRun({ text: " but has significant security gaps and data integrity risks that must be addressed before it can be considered production-hardened.", size: 22 }),
        ]}),

        // Score boxes
        new Paragraph({ spacing: { before: 300 } }),
        new Table({
          columnWidths: [4680, 4680],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 4680, type: WidthType.DXA }, shading: { fill: "FFF3E0", type: ShadingType.CLEAR }, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [new TextRun({ text: "Quality Score", size: 20, color: "E65100", bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${QUALITY_SCORE} / 100`, size: 48, bold: true, color: "E65100" })] }),
            ]}),
            new TableCell({ borders: cellBorders, width: { size: 4680, type: WidthType.DXA }, shading: { fill: "FFF3E0", type: ShadingType.CLEAR }, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [new TextRun({ text: "Production Readiness", size: 20, color: "E65100", bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${READINESS_PCT}%`, size: 48, bold: true, color: "E65100" })] }),
            ]}),
          ]})]
        }),
        new Paragraph({ spacing: { before: 200 } }),

        // Top 3 Critical
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Top 3 Critical Findings")] }),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "No rate limiting on authentication: ", bold: true, size: 22 }),
          new TextRun({ text: "PIN login can be brute-forced. 6-digit PINs have only 1 million combinations.", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "Missing overpayment protection: ", bold: true, size: 22 }),
          new TextRun({ text: "Split payments can exceed order total with no validation, enabling revenue theft.", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "qw-list", level: 0 }, children: [
          new TextRun({ text: "Race conditions in financial operations: ", bold: true, size: 22 }),
          new TextRun({ text: "Loyalty points and discounts lack proper transaction isolation, allowing double-awards under concurrency.", size: 22 }),
        ]}),

        // Top 3 Quick Wins
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Top 3 Quick Wins")] }),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Apply existing authRateLimiter to login routes ", bold: true, size: 22 }),
          new TextRun({ text: "(30 min, prevents brute force)", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Add Redis password ", bold: true, size: 22 }),
          new TextRun({ text: "(1 hour, secures job queue)", size: 22 }),
        ]}),
        new Paragraph({ numbering: { reference: "t1-list", level: 0 }, children: [
          new TextRun({ text: "Add timeout to frontend Axios ", bold: true, size: 22 }),
          new TextRun({ text: "(5 min, prevents frozen UI)", size: 22 }),
        ]}),

        // Issue summary
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Issue Summary")] }),
        new Table({
          columnWidths: [4680, 2340, 2340],
          rows: [
            new TableRow({ children: [hdrCell("Severity", 4680), hdrCell("Count", 2340), hdrCell("% of Total", 2340)] }),
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

        // ===== 3. SCORING BREAKDOWN =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Scoring Breakdown")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Each category is scored 0-100 and weighted to produce the overall Quality Score. The weights reflect the relative importance of each area for a production API handling financial transactions.", size: 22 })] }),
        new Table({
          columnWidths: [2200, 1200, 1200, 4760],
          rows: [
            new TableRow({ children: [hdrCell("Category", 2200), hdrCell("Weight", 1200), hdrCell("Score", 1200), hdrCell("Rationale", 4760)] }),
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
          new TextRun({ text: "Weighted Score Calculation: ", bold: true, size: 22 }),
          new TextRun({ text: `${categoryScores.map(c => `${c.category} (${parseFloat(c.weight)}% x ${c.score})`).join(" + ")} = ${QUALITY_SCORE}/100`, size: 20 }),
        ]}),

        // ===== 4. DETAILED FINDINGS =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Detailed Findings")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Findings are grouped by category. Each includes the exact file location, impact description, severity, and a concrete fix recommendation that a junior developer can follow.", size: 22 })] }),

        ...Object.entries(findings).flatMap(([category, items]) => [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(category)] }),
          new Table({
            columnWidths: [900, 900, 2100, 1800, 1800, 1860],
            rows: [
              new TableRow({ children: [hdrCell("ID", 900), hdrCell("Sev", 900), hdrCell("Issue", 2100), hdrCell("File", 1800), hdrCell("Impact", 1800), hdrCell("Fix", 1860)] }),
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

        // ===== 5. IMPLEMENTATION ROADMAP =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Implementation Roadmap")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Fixes are organized into three tiers based on risk and urgency. Each tier can be implemented incrementally without breaking the live API. Tier 1 should be completed before any new feature work.", size: 22 })] }),

        ...roadmap.flatMap(tier => [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(tier.tier)] }),
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: tier.desc, size: 22, italics: true, color: "546E7A" })] }),
          new Table({
            columnWidths: [1200, 4060, 1200, 2900],
            rows: [
              new TableRow({ children: [hdrCell("Fix #", 1200), hdrCell("Description", 4060), hdrCell("Effort", 1200), hdrCell("Dependency", 2900)] }),
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

        // ===== 6. APPENDIX =====
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Appendix")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("A. Full Issue Table")] }),
        new Table({
          columnWidths: [1200, 1000, 2800, 4360],
          rows: [
            new TableRow({ children: [hdrCell("ID", 1200), hdrCell("Severity", 1000), hdrCell("Title", 2800), hdrCell("File", 4360)] }),
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

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("B. Positive Findings")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "The audit also identified several well-implemented patterns that should be preserved:", size: 22 })] }),
        ...[
          "HttpOnly, Secure, SameSite cookie configuration for JWT tokens",
          "Consistent asyncHandler wrapper across all controller functions",
          "Defense-in-depth tenant scoping (tenantId in every query WHERE clause)",
          "Extensive Zod input validation on most endpoints",
          "Atomic order number generation with UPSERT and exponential backoff retry",
          "Timing-safe HMAC comparison (timingSafeEqual) preventing timing attacks",
          "SERIALIZABLE isolation level for payment sync operations",
          "Graceful shutdown with SIGTERM/SIGINT handlers and cleanup sequence",
        ].map(text => new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun({ text, size: 22 })] })),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("C. Files Reviewed")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "The audit covered 150+ files including:", size: 22 })] }),
        ...[
          "26 controller files (backend/src/controllers/)",
          "37 service files (backend/src/services/)",
          "8 middleware files (backend/src/middleware/)",
          "19 route files (backend/src/routes/)",
          "6 lib files (backend/src/lib/)",
          "6 integration files (backend/src/integrations/delivery/)",
          "9 test files (backend/tests/)",
          "Prisma schema and 7 migrations",
          "Docker Compose (dev + prod), Dockerfiles, .env files",
          "Frontend security scan (api.ts, SocketContext.tsx, key pages)",
        ].map(text => new Paragraph({ numbering: { reference: "files-list", level: 0 }, children: [new TextRun({ text, size: 22 })] })),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("D. Dependency Audit Note")] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "A full npm audit was not executed as part of this code review. Recommendation: run 'npm audit --production' and address any high/critical advisories as part of Tier 1 fixes.", size: 22 })] }),

        // Closing
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "--- End of Report ---", size: 22, color: "999999", italics: true })] }),
      ],
    },
  ],
});

// ============================================================
// GENERATE
// ============================================================
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("code-audit-report.docx", buffer);
  console.log("Generated: code-audit-report.docx (" + Math.round(buffer.length / 1024) + " KB)");
}).catch(err => { console.error("Failed:", err); process.exit(1); });
