# PENTIUMPOS - INFORME DE AUDITORÍA DEL ARQUITECTO PRINCIPAL

**Fecha de Auditoría:** 2026-01-31
**Auditor:** Arquitecto Principal de Software Distinguido
**Alcance:** Auditoría completa del código (Backend + Frontend + Base de Datos + Infraestructura)
**Sistema:** Node.js 20 + Express 5 + Prisma ORM + MySQL 8.0 + React 19.2 + Vite + Zustand
**Total de Archivos Auditados:** 88 (26 controladores, 35 servicios, 16 infraestructura, 11 frontend)

---

## 1. RESUMEN EJECUTIVO

PentiumPOS es una plataforma SaaS multi-tenant para gestión de restaurantes que abarca POS, gestión de mesas, pantalla de cocina (KDS), integración de delivery, programas de fidelización, facturación fiscal, menús QR y control de inventario. El código comprende 33 modelos Prisma, 26 controladores backend, 35 servicios backend y un frontend PWA con React 19.2.

### Composición del Sistema

| Capa | Cantidad | Detalles |
|------|----------|----------|
| Modelos Prisma | 33 | Todos con tenantId (aislamiento estricto) |
| Controladores Backend | 26 | 100+ endpoints |
| Servicios Backend | 35+ | Capa de lógica de negocio |
| Servicios Frontend | 24 | Comunicación con API |
| Stores Zustand | 4 | auth, pos, kitchen, cash |
| Enums | 14 | Valores de dominio con tipado seguro |
| Índices de BD | 60+ | Simples, compuestos, únicos |
| Migraciones | 5 | Multi-tenancy progresiva |

### Fortalezas

- **Aislamiento multi-tenant** generalmente bien implementado con `tenantId` en los 33 modelos y patrones de defensa en profundidad con `updateMany`.
- **Autenticación con cookies HttpOnly** (corrección P0-004) elimina vectores de robo de tokens por XSS.
- **Registro de auditoría** implementado para operaciones críticas (modelo AuditLog de solo escritura con 21 tipos de acción).
- **Feature flags** mediante TenantConfig permiten activación de módulos por tenant.
- **Validación Zod** utilizada en la mayoría de controladores para sanitización de entrada.
- **Prevención de prototype pollution** mediante middleware (`sanitizeBody`) implementado.
- **Generación de números de orden** usa sharding por hora con reintentos/backoff para prevenir colisiones (reducción de contención 24x).
- **Gestión de turnos de caja** usa nivel de aislamiento SERIALIZABLE previniendo condiciones de carrera.
- **PWA offline-first** con IndexedDB (Dexie) y caché de service worker.
- **Actualizaciones en tiempo real** via Socket.IO con adaptador Redis para escalado horizontal.

### Debilidades Críticas

- **5 problemas P0** que requieren remediación inmediata, incluyendo una fuga de datos cross-tenant en el servicio de plataformas de delivery, una verificación de autorización faltante en la configuración del tenant, y una máquina de estados que advierte pero no bloquea transiciones inválidas.
- **12 problemas P1** que abarcan escaneos bcrypt O(n), RBAC faltante en rutas de inventario, controladores que omiten la capa de servicios, e idempotencia en memoria que rompe el escalado horizontal.
- **8 preocupaciones P2 de escalabilidad** incluyendo paginación faltante, patrones de consulta N+1, y sin configuración de pool de conexiones.
- **15+ problemas P3 de calidad de código** incluyendo proliferación del tipo `any`, formatos de respuesta inconsistentes, números mágicos, e idioma mixto en mensajes de error.

### Evaluación de Riesgos

| Categoría | Nivel de Riesgo | Cantidad |
|-----------|----------------|----------|
| P0 - Crítico (Filtración de Datos / Seguridad) | CRÍTICO | 5 |
| P1 - Alto (Funcional / Rendimiento) | ALTO | 12 |
| P2 - Escalabilidad | MEDIO | 8 |
| P3 - Calidad de Código | BAJO | 15+ |

**Veredicto General:** El sistema es funcional para despliegue de un solo pod y bajo volumen, pero contiene vulnerabilidades de seguridad críticas que DEBEN ser abordadas antes de cualquier despliegue en producción.

---

## 2. PROBLEMAS CRÍTICOS (P0) - Corregir Antes del Despliegue

### 2.1 Vulnerabilidades de Seguridad

#### P0-001: Fuga de Datos Cross-Tenant en el Servicio DeliveryPlatform

**Archivo:** `backend/src/services/delivery.service.ts`
**Líneas:** 37-97 (todos los métodos de plataforma)
**Severidad:** CRÍTICA - Potencial de filtración de datos

Todos los métodos CRUD de plataforma operan sin filtrado por `tenantId`. Cualquier usuario autenticado del Tenant A puede leer, modificar y eliminar plataformas pertenecientes al Tenant B, incluyendo la exfiltración de claves API y secretos de webhook.

```typescript
// LÍNEA 37-41 - SIN filtro tenantId
async getAllPlatforms(): Promise<DeliveryPlatform[]> {
    return prisma.deliveryPlatform.findMany({
        orderBy: { name: 'asc' }
    });
}

// LÍNEA 71-76 - SIN tenantId en update
async updatePlatform(id: number, data: PlatformUpdateData): Promise<DeliveryPlatform> {
    return prisma.deliveryPlatform.update({ where: { id }, data });
}

// LÍNEA 86-90 - SIN tenantId en delete
async deletePlatform(id: number): Promise<void> {
    await prisma.deliveryPlatform.delete({ where: { id } });
}
```

**Impacto:** Exposición completa de datos cross-tenant. El Tenant A puede leer claves API, secretos de webhook e IDs de tienda de todos los tenants.

**Corrección:** Agregar parámetro `tenantId` a todos los métodos de plataforma. Si DeliveryPlatform es una tabla de referencia global, separar los secretos por tenant en la tabla intermedia `TenantPlatformConfig` (que ya existe pero no se usa consistentemente).

```typescript
// CORREGIDO
async getAllPlatforms(tenantId: number): Promise<DeliveryPlatform[]> {
    return prisma.deliveryPlatform.findMany({
        where: { /* plataformas globales */ },
        include: {
            tenantConfigs: { where: { tenantId } }
        },
        orderBy: { name: 'asc' }
    });
}
```

**Complejidad:** O(1) - Esfuerzo medio de corrección.

---

#### P0-002: Autorización Faltante en Endpoint de Configuración del Tenant

**Archivo:** `backend/src/routes/config.routes.ts`
**Líneas:** 44-68
**Severidad:** CRÍTICA - Escalación de privilegios

El endpoint `PATCH /api/v1/config` tiene un TODO sin implementar para verificación de rol admin. Cualquier usuario autenticado (mozo, personal de cocina) puede modificar toda la configuración del tenant incluyendo feature flags, configuración de negocio y temas del menú QR.

```typescript
// LÍNEA 44-48
router.patch('/config', authenticateToken, async (req: Request, res: Response) => {
    // TODO: Verificar si el usuario tiene rol admin   // <-- NUNCA IMPLEMENTADO
    const updates = req.body;
    const config = await updateTenantConfig(updates, req.user!.tenantId);
```

**Impacto:** Cualquier mozo o personal de cocina puede deshabilitar funcionalidades, cambiar configuración de negocio o corromper la configuración del tenant.

**Corrección:**
```typescript
router.patch('/config', authenticateToken, requirePermission('settings', 'update'), async (req: Request, res: Response) => {
```

**Complejidad:** O(1) - Adición de una sola línea.

---

### 2.2 Riesgos de Integridad de Datos

#### P0-003: La Máquina de Estados de Órdenes No Bloquea Transiciones Inválidas

**Archivo:** `backend/src/services/orderStatus.service.ts`
**Líneas:** 69-71
**Severidad:** CRÍTICA - Violación de integridad de datos

La máquina de estados valida transiciones pero solo registra una advertencia y continúa. Las órdenes pueden saltar estados, reabrirse desde CANCELADA, o transicionar de maneras lógicamente imposibles.

```typescript
// LÍNEA 69-71
if (!allowedNextStatuses.includes(status)) {
    console.warn(`[OrderStatusService] Transición inválida... Continuando de todas formas.`);
    // NO LANZA EXCEPCIÓN - CONTINÚA CON TRANSICIÓN INVÁLIDA
}
```

**Impacto:** Las órdenes pueden ser CANCELADAS y luego movidas a ENTREGADA. Los reportes financieros se vuelven poco confiables. La cocina recibe instrucciones contradictorias.

**Corrección:**
```typescript
if (!allowedNextStatuses.includes(status)) {
    throw new ValidationError(
        `Transición de estado de orden inválida de ${currentStatus} a ${status}. ` +
        `Transiciones permitidas: ${allowedNextStatuses.join(', ')}`
    );
}
```

**Complejidad:** O(1) - Baja.

---

### 2.3 Brechas de Aislamiento Multi-Tenant

#### P0-004: Rutas de Inventario Sin Verificaciones de Permisos RBAC

**Archivo:** `backend/src/routes/inventory.routes.ts`
**Líneas:** 12-22
**Severidad:** CRÍTICA - Autorización faltante

Todas las rutas de inventario (CRUD de ingredientes, movimientos de stock) requieren solo autenticación sin ninguna verificación de permisos. Cualquier usuario autenticado (mozo, pantalla de cocina) puede eliminar ingredientes, registrar movimientos de stock falsos y corromper datos de inventario.

```typescript
// Sin middleware requirePermission en NINGUNA ruta
router.post('/ingredients', IngredientController.createIngredient);     // ¡Sin permiso!
router.delete('/ingredients/:id', IngredientController.deleteIngredient); // ¡Sin permiso!
router.post('/stock-movements', StockController.registerMovement);       // ¡Sin permiso!
```

**Corrección:**
```typescript
router.get('/ingredients', requirePermission('stock', 'read'), IngredientController.getIngredients);
router.post('/ingredients', requirePermission('stock', 'create'), IngredientController.createIngredient);
router.put('/ingredients/:id', requirePermission('stock', 'update'), IngredientController.updateIngredient);
router.delete('/ingredients/:id', requirePermission('stock', 'delete'), IngredientController.deleteIngredient);
router.post('/stock-movements', requirePermission('stock', 'create'), StockController.registerMovement);
router.get('/stock-movements', requirePermission('stock', 'read'), StockController.getMovementHistory);
```

**Complejidad:** O(1) - Baja.

---

#### P0-005: Eliminación de Rol Usa prisma.role.delete Sin Protección de tenantId

**Archivo:** `backend/src/controllers/role.controller.ts`
**Línea:** 221
**Severidad:** CRÍTICA - Eliminación cross-tenant por TOCTOU

A pesar de la verificación de propiedad vía `findFirst` con tenantId (línea 203), la eliminación usa `prisma.role.delete({ where: { id } })` sin tenantId. Entre la verificación y la eliminación, una condición de carrera podría permitir eliminación cross-tenant.

```typescript
// LÍNEA 203 - Verifica propiedad
const role = await prisma.role.findFirst({ where: { id, tenantId } });

// LÍNEA 221 - Elimina SIN protección de tenantId (vulnerabilidad TOCTOU)
await prisma.role.delete({ where: { id } });
```

**Corrección:**
```typescript
await prisma.role.deleteMany({ where: { id, tenantId: req.user!.tenantId! } });
```

**Complejidad:** O(1) - Baja.

---

## 3. PROBLEMAS DE ALTA PRIORIDAD (P1) - Corregir Este Sprint

### 3.1 Brechas en Manejo de Errores

#### P1-001: Comparación Bcrypt O(n) para Unicidad de PIN

**Archivo:** `backend/src/controllers/user.controller.ts`
**Líneas:** 211-222, 296-309
**Severidad:** ALTA - Vector de DoS

La unicidad del PIN se verifica obteniendo TODOS los usuarios con PINs y realizando comparaciones bcrypt secuenciales (~100ms cada una). Para 100 usuarios: 10 segundos de tiempo de CPU bloqueante.

```typescript
const usersWithPin = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId!, pinHash: { not: null } }
});
for (const existingUser of usersWithPin) {
    if (await bcrypt.compare(pinCode, existingUser.pinHash!)) {
        // PIN ya en uso
    }
}
```

**Complejidad Temporal:** O(n) * 100ms por comparación bcrypt.

**Corrección:** Usar la columna existente `pinLookup` SHA-256 para búsqueda indexada O(1):
```typescript
const pinLookup = generatePinLookup(pinCode);
const existing = await prisma.user.findFirst({
    where: { tenantId, pinLookup, id: { not: excludeUserId } }
});
if (existing) throw new ConflictError('PIN ya en uso');
```

**Complejidad:** Búsqueda O(1) vs escaneo O(n).

---

#### P1-006: Socket.IO Sin Manejo de Fallo de Autenticación en Frontend

**Archivo:** `frontend/src/context/SocketContext.tsx`
**Severidad:** ALTA - Fallo silencioso

Sin handler `connect_error` para fallos de autenticación. El socket se desconecta silenciosamente al expirar el JWT. El personal de cocina pierde órdenes sin ninguna indicación.

**Corrección:**
```typescript
socket.on('connect_error', (error) => {
    if (error.message === 'authentication_error') {
        logout();
        navigate('/login');
    }
});
```

---

### 3.2 Seguridad Transaccional

#### P1-008: Actualización de Orden Sin tenantId en WHERE

**Archivo:** `backend/src/services/orderStatus.service.ts`
**Líneas:** 94-96
**Severidad:** ALTA - Mutación cross-tenant por TOCTOU

```typescript
// LÍNEA 94-96
await prisma.order.update({
    where: { id: orderId },  // ¡SIN tenantId!
    data: { status }
});
```

**Corrección:** Usar `updateMany` con tenantId:
```typescript
const result = await prisma.order.updateMany({
    where: { id: orderId, tenantId },
    data: { status }
});
if (result.count === 0) throw new NotFoundError('Orden no encontrada');
```

---

#### P1-005: Actualización de Cliente Sin Protección de tenantId

**Archivo:** `backend/src/controllers/client.controller.ts`
**Líneas:** 55-61
**Severidad:** ALTA - Mutación cross-tenant por TOCTOU

```typescript
// Verifica propiedad vía findFirst (correcto)
const existing = await prisma.client.findFirst({ where: { id, tenantId } });
// Actualiza SIN tenantId (brecha TOCTOU)
await prisma.client.update({ where: { id: existing.id }, data });
```

**Corrección:** Usar `updateMany` con tenantId en la cláusula WHERE.

---

### 3.3 Brechas de Validación de Entrada

#### P1-012: Servicio de Delivery Usa `status as any` para Evadir Tipado

**Archivo:** `backend/src/services/delivery.service.ts`
**Línea:** 246
**Severidad:** ALTA - Evasión de seguridad de tipos

```typescript
data: { status: status as any }  // Evade validación de enum de Prisma
```

**Corrección:** Validar contra el enum `OrderStatus` antes de pasar a Prisma:
```typescript
import { OrderStatus } from '@prisma/client';
if (!Object.values(OrderStatus).includes(status)) {
    throw new ValidationError(`Estado inválido: ${status}`);
}
```

---

### 3.4 Problemas de Diseño de API

#### P1-002: Caché de Idempotencia en Memoria Rompe el Escalado Horizontal

**Archivo:** `backend/src/middleware/idempotency.ts`
**Línea:** 9
**Severidad:** ALTA - Órdenes duplicadas en despliegue multi-pod

```typescript
const idempotencyCache = new Map<string, { response: any; timestamp: number }>();
```

Cada pod tiene caché aislado; reintentos dirigidos a pods diferentes evaden la idempotencia completamente.

**Corrección:** Reemplazar con Redis SETEX:
```typescript
import { redis } from '../lib/redis';

const key = `idempotency:${idempotencyKey}`;
const cached = await redis.get(key);
if (cached) return res.status(200).json(JSON.parse(cached));
// ... después de la respuesta
await redis.setex(key, 300, JSON.stringify(responseBody));
```

---

#### P1-003: Controlador de Cliente Omite la Capa de Servicios

**Archivo:** `backend/src/controllers/client.controller.ts`
**Severidad:** ALTA - Violación arquitectónica

Llamadas directas a Prisma en vez de delegación al servicio. Upsert implícito por coincidencia de teléfono sin contrato de API claro.

**Corrección:** Extraer todas las operaciones de base de datos a `client.service.ts`.

---

#### P1-004: Número Mágico `id <= 5` para Protección de Roles del Sistema

**Archivo:** `backend/src/controllers/role.controller.ts`
**Línea:** 198
**Severidad:** ALTA - Error lógico para multi-tenant

```typescript
if (id <= 5) return sendError(res, 'FORBIDDEN', 'No se pueden modificar roles del sistema');
```

Esto solo funciona para los roles iniciales del primer tenant. Los roles del segundo tenant comienzan en id 6+.

**Corrección:** Agregar columna `isSystem: Boolean @default(false)` al modelo Role, o verificar por patrón de nombre de rol.

---

#### P1-007: loginPin del Frontend No Envía tenantId

**Archivo:** `frontend/src/store/auth.store.ts`
**Severidad:** ALTA - Colisión de PIN cross-tenant

El login por PIN omite contexto de tenant. El backend recurre a escanear TODOS los tenants buscando coincidencia de PIN.

**Corrección:** Incluir identificador de tenant (código o subdominio) en el payload de login por PIN.

---

#### P1-009: Controlador de Impresora Omite la Capa de Servicios

**Archivo:** `backend/src/controllers/printer.controller.ts`
**Severidad:** MEDIA - Violación arquitectónica

Llamadas directas a Prisma para todas las operaciones CRUD a pesar de que `printer.service.ts` existe.

**Corrección:** Enrutar todas las operaciones a través de la capa de servicios existente.

---

#### P1-010: Rate Limiting Faltante en Endpoints de Usuario

**Severidad:** MEDIA - Vector de enumeración de PINs

Los endpoints de gestión de usuarios con verificaciones bcrypt de PIN no tienen rate limiting.

**Corrección:** Agregar middleware de rate limiting a las rutas CRUD de usuario.

---

#### P1-011: createClient Retorna 200 Tanto para Creación como Actualización

**Archivo:** `backend/src/controllers/client.controller.ts`
**Severidad:** MEDIA - Violación del contrato de API

El endpoint POST retorna 200 tanto para creación nueva como para upsert implícito.

**Corrección:** Retornar 201 para creación, 200 para upsert con diferenciación clara en la respuesta.

---

## 4. PREOCUPACIONES DE ESCALABILIDAD (P2)

### 4.1 Rendimiento de Consultas a Base de Datos

#### P2-001: Sin Paginación en Endpoints de Listado

**Archivos:** Múltiples controladores (productos, categorías, clientes, ingredientes, proveedores, etc.)
**Severidad:** MEDIA

La mayoría de las llamadas `findMany` retornan conjuntos de resultados sin límite. A medida que los datos crecen, los tamaños de respuesta y tiempos de consulta aumentan linealmente.

**Corrección:** Implementar paginación basada en cursor o por offset:
```typescript
const { page = 1, limit = 50 } = req.query;
const results = await prisma.product.findMany({
    where: { tenantId },
    skip: (page - 1) * limit,
    take: Math.min(limit, 100), // Máximo 100
    orderBy: { id: 'asc' }
});
```

---

### 4.2 Problemas de Consultas N+1

#### P2-002: N+1 en Registro de Movimientos de Stock

**Archivo:** `backend/src/services/stockMovement.service.ts`
**Severidad:** MEDIA

Al procesar ítems de orden para deducción de stock, cada búsqueda y actualización de ingrediente es una consulta separada. Para una orden con 20 ítems, cada uno con 3 ingredientes: 60+ consultas individuales.

**Corrección:** Agrupar búsquedas de ingredientes y usar `updateMany` con valores calculados.

---

### 4.3 Problemas de Pool de Conexiones

#### P2-004: Sin Configuración de Pool de Conexiones

**Archivo:** `backend/prisma/schema.prisma`
**Severidad:** MEDIA

La cadena de conexión tiene `connection_limit=20&pool_timeout=20` pero sin configuración de pool a nivel de Prisma. Bajo carga, el agotamiento del pool causa fallos en cascada.

**Corrección:** Configurar el pool de conexiones de Prisma explícitamente:
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  // Agregar configuración de pool
}
```

Y en DATABASE_URL: `?connection_limit=20&pool_timeout=30`

---

### 4.4 Cuellos de Botella de Memoria/CPU

#### P2-006: Crecimiento Ilimitado del Map en Middleware de Idempotencia

**Archivo:** `backend/src/middleware/idempotency.ts`
**Severidad:** MEDIA - Fuga de memoria

El `Map` en memoria crece sin límite. Aunque hay un intervalo de limpieza, los períodos de alto tráfico acumulan entradas más rápido que la limpieza.

**Corrección:** Usar Redis con TTL (ver P1-002) o implementar caché LRU con tamaño máximo.

---

#### P2-003: Caché de Feature Flags Sin Invalidación

**Archivo:** `backend/src/services/featureFlags.service.ts`
**Severidad:** BAJA-MEDIA

El caché con TTL de 60 segundos significa que los cambios de configuración tardan hasta 60s en propagarse. Sin invalidación de caché al actualizar configuración.

**Corrección:** Invalidar caché en el endpoint `PATCH /config`. Agregar Redis pub/sub para invalidación multi-pod.

---

### 4.5 Índices Faltantes

#### P2-008: Índices Compuestos Faltantes para Patrones de Consulta Comunes

**Archivo:** `backend/prisma/schema.prisma`

| Modelo | Índice Faltante | Patrón de Consulta |
|--------|----------------|-------------------|
| OrderItem | `[orderId, status]` | Filtrado KDS |
| StockMovement | `[tenantId, createdAt]` | Consultas temporales de analítica |
| Client | Full-text en `name, phone` | Funcionalidad de búsqueda |
| Payment | `[tenantId, createdAt]` | Reportes basados en tiempo |
| Order | `[tenantId, channel]` | Filtrado por canal |

---

#### P2-005: Parsing de Fechas Frágil en Analíticas

**Archivo:** `backend/src/controllers/analytics.controller.ts`
**Severidad:** BAJA-MEDIA

Parámetros de fecha parseados mediante manipulación de strings sin validación. Fechas inválidas producen consultas incorrectas silenciosamente.

**Corrección:** Usar validación de fecha con Zod o parsing con `dayjs` en modo estricto.

---

#### P2-007: Payload Sobre-Cargado de Órdenes de Delivery

**Archivo:** `backend/src/services/delivery.service.ts`
**Severidad:** BAJA-MEDIA

Las consultas de órdenes de delivery incluyen relaciones anidadas profundas que pueden no ser necesarias para vistas de lista.

**Corrección:** Usar `select` en vez de `include` para endpoints de listado; reservar `include` completo para vistas de detalle.

---

## 5. CALIDAD DE CÓDIGO Y ESTÁNDARES (P3)

### 5.1 Violaciones de Principios SOLID

| Violación | Archivos | Descripción |
|-----------|----------|-------------|
| **Responsabilidad Única** | client.controller.ts, printer.controller.ts | Controladores contienen llamadas directas a Prisma (deberían delegar a servicios) |
| **Inversión de Dependencias** | 3 controladores | Importación directa de Prisma en vez de abstracción por servicios |
| **Abierto/Cerrado** | orderStatus.service.ts | Máquina de estados hardcodeada; agregar nuevos estados requiere modificar código existente |

---

### 5.2 Violaciones DRY

| Ubicación | Duplicación |
|-----------|-------------|
| `frontend/src/modules/orders/tables/components/TableDetailModal.tsx` + `POSPage.tsx` | Lógica de cálculo de totales duplicada |
| Múltiples controladores | Patrón de extracción `req.user!.tenantId!` repetido 100+ veces |
| Múltiples servicios | Construcción de cláusula WHERE con tenantId repetida en cada consulta |

---

### 5.3 Patrones de Manejo de Errores

| Patrón | Problema |
|--------|----------|
| `catch (error: any)` | 40+ instancias en todo el código |
| `console.warn` para errores críticos | orderStatus.service.ts línea 70 |
| `alert()` en frontend | POSPage.tsx tiene 5 instancias de alert() nativo |
| Formatos mixtos de respuesta de error | Algunos usan `sendError()`, otros usan `res.status().json()` |

---

### 5.4 Uso de TypeScript

| Problema | Alcance | Impacto |
|----------|---------|---------|
| Aserciones de tipo `as any` | 40+ instancias | Evade seguridad de tipos |
| Tipos de retorno faltantes | Muchos métodos de servicio | Retornos implícitos `any` |
| `error: any` en bloques catch | Todo el código | Sin narrowing de tipo de error |
| Aserciones non-null `!` | Controladores (`req.user!.tenantId!`) | Crash en runtime si el middleware falla |

---

### 5.5 Convenciones de Nomenclatura

| Problema | Ejemplos |
|----------|----------|
| Inglés/Español mixto | Mensajes de error, comentarios, nombres de variables |
| Comentarios de desarrollo en producción | `CategoryList.tsx` líneas 83-89 |
| Casing inconsistente | Algunos servicios usan patrón de clase, otros usan objetos literales |
| Números mágicos | `id <= 5`, `take: 20`, `limit: 50` sin constantes |

---

## 6. REVISIÓN DE ARQUITECTURA FRONTEND

### 6.1 Gestión de Estado

**Calificación General: B**

| Aspecto | Evaluación |
|---------|------------|
| Stores Zustand | Bien estructurados, estado global mínimo |
| Store Auth | Cookies HttpOnly (seguro), verificación de permisos RBAC |
| Store POS | Deduplicación inteligente del carrito, soporte de modificadores |
| Store Kitchen | Preferencias persistidas, filtrado por estación |
| Store Cash | Gestión adecuada del ciclo de vida de turnos |

**Problemas:**
- Tipos `any` en interfaces de estado
- Soluciones alternativas con refs para closures obsoletos en POSPage (líneas 146-155) indican necesidad de `useReducer`
- Sin actualizaciones optimistas de UI para mutaciones

---

### 6.2 Comunicación con API

**Calificación General: B+**

| Aspecto | Evaluación |
|---------|------------|
| Configuración Axios | Limpia con interceptores adecuados |
| Manejo de errores | Mensajes amigables en español |
| Manejo de 401 | Auto-logout y redirección |
| withCredentials | Correctamente configurado para cookies HttpOnly |

**Problemas:**
- Potencial bucle infinito de 401 en handler de logout (capturado pero ineficiente)
- Sin cancelación de requests al desmontar componentes
- Sin lógica de reintento para fallos transitorios

---

### 6.3 Manejo de Errores

**Calificación General: B-**

| Aspecto | Evaluación |
|---------|------------|
| ErrorBoundary | Presente, captura errores de React |
| Errores de API | Interceptor provee mensajes amigables |
| errorUtils.ts | Utilidades completas de parsing de errores |

**Problemas:**
- 5 instancias de `alert()` nativo en POSPage.tsx
- Anti-patrón `window.location.reload()` en SettingsPage
- Sin sistema de toast/notificación para feedback al usuario

---

### 6.4 Rendimiento

**Calificación General: B+**

| Aspecto | Evaluación |
|---------|------------|
| Code splitting | Todas las rutas cargadas lazy con React.lazy() |
| Caché PWA | Service worker con estrategias Workbox |
| Bundle | Vite con tree-shaking y minificación |
| Estado | Zustand (overhead mínimo) |

**Problemas:**
- Violaciones del array de dependencias de `useEffect` en POSPage (línea 46)
- Sin `useMemo`/`useCallback` para cálculos costosos en grillas de productos
- Falta React.memo en ítems de lista que se re-renderizan frecuentemente

---

### 6.5 Soporte Offline

**Calificación General: B+**

| Aspecto | Evaluación |
|---------|------------|
| IndexedDB | Dexie con versionado de schema adecuado |
| Cola | Órdenes/pagos pendientes encolados offline |
| Sincronización | Sync pull/push con detección de conflictos |
| Conectividad | Detección online/offline |

**Problemas:**
- Sin estrategia de resolución de conflictos documentada
- Sin indicador de UI para estado de sincronización
- Datos en caché pueden volverse obsoletos sin invalidación

---

## 7. REVISIÓN DE ARQUITECTURA DE BASE DE DATOS

### 7.1 Diseño de Schema

**Calificación General: B+**

| Aspecto | Evaluación |
|---------|------------|
| Multi-tenancy | tenantId en los 33 modelos (estricto) |
| Relaciones | Bien definidas 1:N, N:M vía tablas intermedias |
| Enums | 14 enums con tipado seguro para valores de dominio |
| Cascading | RESTRICT en FKs de tenant (seguro), CASCADE en hijos |
| Precisión financiera | Decimal(10,2) para precios, Decimal(10,4) para costos |

**Problemas:**
- Sin patrón de soft delete (deletedAt) en modelos críticos
- Sin restricciones CHECK para valores no negativos
- `ModifierOption.qtyUsed` usa Decimal(65,30) - precisión extrema innecesaria
- Sin relaciones auto-referenciales para categorías jerárquicas

---

### 7.2 Estrategia de Índices

**Calificación General: B**

| Aspecto | Evaluación |
|---------|------------|
| Índices tenantId | Los 31 modelos con tenant indexados |
| Unique compuesto | Correctamente limitado al tenant (@@unique([tenantId, name])) |
| Índices FK | Todas las claves foráneas indexadas |
| Patrones de consulta | Índices compuestos clave presentes |

**Índices Faltantes:**
- `OrderItem.[orderId, status]` para consultas KDS
- `StockMovement.[tenantId, createdAt]` para analíticas
- `Client` full-text en name/phone para búsqueda
- `Payment.[tenantId, createdAt]` para reportes basados en tiempo

---

### 7.3 Seguridad de Migraciones

**Calificación General: A-**

| Aspecto | Evaluación |
|---------|------------|
| Enfoque progresivo | 5 migraciones, cada una construyendo sobre la anterior |
| Scripts de backfill | analyze-tenant-data.ts, fix-null-tenantids.ts |
| Aislamiento final | Migración 5 hizo todos los tenantId NOT NULL |
| Restricciones FK | Cambiadas de SET NULL a RESTRICT |

**Problemas:**
- TenantConfig.id cambió de DEFAULT 1 a AUTO_INCREMENT - código antiguo podría asumir id=1
- OrderSequence usa clave por hora (`YYYYMMDDHH`) pero la restricción unique de Order es diaria - posible desalineación

---

### 7.4 Tipos de Datos

| Tipo de Campo | Uso | Evaluación |
|---------------|-----|------------|
| Decimal(10,2) | Precios, totales | Apropiado |
| Decimal(10,4) | Costos de ingredientes, stock | Apropiado |
| Decimal(65,30) | qtyUsed, minStock | Excesivo - estandarizar a Decimal(10,4) |
| DateTime(3) | Timestamps | Precisión de milisegundos - apropiado |
| DATE | businessDate | Correcto para campos solo de fecha |
| JSON | permissions, uiSettings, theme | Apropiado para schemas flexibles |

---

## 8. INFRAESTRUCTURA Y DEVOPS

### 8.1 Configuración Docker

**Archivo:** `docker-compose.yml`

| Aspecto | Evaluación |
|---------|------------|
| MySQL 8.0 | Imagen correcta con especificación de plataforma |
| Límites de recursos | Memoria 1GB, CPU 1.0 core |
| Healthcheck | mysqladmin ping cada 10s |
| Zona horaria | America/Argentina/Buenos_Aires |

**Problemas:**
- Credenciales de base de datos en archivo compose (usar Docker secrets)
- Sin configuración explícita de volumen de backup
- Sin configuración de driver de logging
- Servicio backend sin límites de recursos

---

### 8.2 Configuración de Entorno

| Aspecto | Evaluación |
|---------|------------|
| Validación ENV | Valida DATABASE_URL, JWT_SECRET al iniciar |
| CORS | Advierte si no está configurado en producción |
| Secretos | JWT_SECRET desde variable de entorno (no hardcodeado) |

**Problemas:**
- Sin `.env.example` con todas las variables requeridas documentadas para backend
- Sin archivos de configuración específicos por entorno
- Estrategia de rotación de JWT_SECRET no implementada

---

### 8.3 Brechas de Monitoreo

| Brecha | Impacto |
|--------|---------|
| Sin integración APM | No se puede rastrear latencia de requests |
| Sin logging estructurado | Parseo de logs difícil a escala |
| Health check solo BD | Faltan verificaciones de Redis, BullMQ, disco/memoria |
| Sin endpoint de métricas | No se pueden monitorear KPIs de negocio |
| Falta `prisma.$disconnect()` | Fuga de conexiones en apagado graceful |
| Sin tracking de errores | Sin integración Sentry/Datadog |

---

## 9. PLAN DE REMEDIACIÓN PRIORIZADO

### Fase 1: Seguridad Crítica (Semana 1) - ~6h Total

| Prioridad | ID | Problema | Archivo | Esfuerzo |
|-----------|-----|---------|--------|----------|
| 1 | P0-001 | Fuga cross-tenant en plataforma de delivery | delivery.service.ts | 4h |
| 2 | P0-002 | Auth faltante en PATCH de config | config.routes.ts:44 | 15min |
| 3 | P0-003 | Máquina de estados no bloquea | orderStatus.service.ts:69 | 30min |
| 4 | P0-004 | RBAC faltante en inventario | inventory.routes.ts:12 | 30min |
| 5 | P0-005 | Delete de rol sin tenantId | role.controller.ts:221 | 15min |

### Fase 2: Alta Prioridad (Semanas 2-3) - ~19h Total

| Prioridad | ID | Problema | Archivo | Esfuerzo |
|-----------|-----|---------|--------|----------|
| 6 | P1-001 | Verificación bcrypt O(n) de PIN | user.controller.ts:211 | 4h |
| 7 | P1-002 | Idempotencia en memoria | idempotency.ts:9 | 4h |
| 8 | P1-008 | Update de orden sin tenantId | orderStatus.service.ts:94 | 1h |
| 9 | P1-005 | Update de cliente sin tenantId | client.controller.ts:55 | 1h |
| 10 | P1-004 | Número mágico `id <= 5` | role.controller.ts:198 | 3h |
| 11 | P1-003 | Controlador de cliente omite servicio | client.controller.ts | 3h |
| 12 | P1-007 | Login PIN sin tenantId | auth.store.ts | 2h |
| 13 | P1-006 | Manejo de fallo de auth en Socket | SocketContext.tsx | 1h |

### Fase 3: Escalabilidad (Semanas 4-6) - ~23h Total

| Prioridad | ID | Problema | Esfuerzo |
|-----------|-----|---------|----------|
| 14 | P2-001 | Agregar paginación a todos los endpoints de listado | 8h |
| 15 | P2-002 | Corregir N+1 en movimientos de stock | 4h |
| 16 | P2-004 | Configurar pool de conexiones | 2h |
| 17 | P2-006 | Corregir fuga de memoria en idempotencia | 2h (cubierto por P1-002) |
| 18 | P2-008 | Agregar índices faltantes de BD | 3h |
| 19 | P2-003 | Invalidación de caché de feature flags | 2h |
| 20 | P2-005 | Corregir parsing de fechas en analíticas | 2h |

### Fase 4: Calidad de Código (Continuo) - ~23h Total

| Prioridad | ID | Problema | Esfuerzo |
|-----------|-----|---------|----------|
| 21 | P3-001 | Eliminar tipos `any` | 8h |
| 22 | P3-002 | Estandarizar formato de respuesta | 4h |
| 23 | P3-008 | Reemplazar alert() con sistema de toast | 3h |
| 24 | P3-004 | Extraer números mágicos a constantes | 2h |
| 25 | P3-005 | DRY en cálculo de totales | 2h |
| 26 | P3-003 | Estandarizar idioma de mensajes de error | 2h |
| 27 | P3-006 | Eliminar comentarios de desarrollo | 1h |
| 28 | P3-007 | Estandarizar uso de clases de error | 1h |

---

## 10. RECOMENDACIONES ARQUITECTÓNICAS

### 10.1 Patrón de Mutación Seguro contra TOCTOU (Corto plazo)

Cada UPDATE/DELETE DEBE incluir `tenantId` en la cláusula WHERE. Adoptar `updateMany`/`deleteMany` exclusivamente para mutaciones con alcance de tenant:

```typescript
// PATRÓN: Mutación con defensa en profundidad
const result = await prisma.order.updateMany({
    where: { id: orderId, tenantId },
    data: { status: newStatus }
});
if (result.count === 0) {
    throw new NotFoundError(`Orden ${orderId} no encontrada`);
}
```

### 10.2 Cumplimiento de Capa de Servicios (Corto plazo)

Los controladores NO DEBEN importar `prisma` directamente. Tres controladores actualmente violan este patrón:
- `client.controller.ts`
- `printer.controller.ts`
- `role.controller.ts`

Agregar una regla ESLint para hacer cumplir esta frontera.

### 10.3 Contexto de Tenant vía AsyncLocalStorage (Mediano plazo)

Eliminar el threading manual de `req.user!.tenantId!` usando AsyncLocalStorage de Node.js:

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContext {
    tenantId: number;
    userId: number;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

// Middleware
app.use((req, res, next) => {
    tenantStore.run({ tenantId: req.user.tenantId, userId: req.user.id }, next);
});

// En cualquier servicio - sin necesidad de pasar parámetros
function getTenantId(): number {
    const ctx = tenantStore.getStore();
    if (!ctx) throw new Error('Sin contexto de tenant');
    return ctx.tenantId;
}
```

### 10.4 Middleware Prisma para Auto-Inyección de Tenant (Mediano plazo)

Implementar middleware de Prisma que auto-inyecte `tenantId` en todas las consultas, eliminando errores de omisión del desarrollador:

```typescript
prisma.$use(async (params, next) => {
    const tenantModels = ['Order', 'Product', 'Client', ...];
    if (tenantModels.includes(params.model)) {
        const tenantId = getTenantId(); // Desde AsyncLocalStorage
        if (params.action === 'findMany' || params.action === 'updateMany') {
            params.args.where = { ...params.args.where, tenantId };
        }
        if (params.action === 'create') {
            params.args.data = { ...params.args.data, tenantId };
        }
    }
    return next(params);
});
```

### 10.5 Middleware de Validación de Request (Corto plazo)

Estandarizar validación Zod como middleware de Express en vez de inline en controladores:

```typescript
function validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return sendError(res, 'VALIDATION_ERROR', result.error.message, 400);
        }
        req.validatedBody = result.data;
        next();
    };
}
```

### 10.6 Arquitectura Orientada a Eventos (Largo plazo)

Descomponer la transacción monolítica de creación de órdenes en eventos de dominio:

```
OrderCreated -> StockDeducted -> KDSNotified -> LoyaltyAwarded -> AuditLogged
```

BullMQ (ya en el stack) puede procesar estos asincrónicamente, mejorando tiempos de respuesta y habilitando lógica de reintento por concern.

### 10.7 Logging Estructurado (Mediano plazo)

Reemplazar `console.log`/`console.warn` con logging estructurado (Pino o Winston):

```typescript
logger.info({
    event: 'order_created',
    orderId: order.id,
    tenantId,
    total: order.total,
    correlationId: req.correlationId
});
```

### 10.8 Estrategia de Versionado de API (Largo plazo)

Actual: `/api/v1/...` - Sin estrategia v2 documentada. Plan:
- Usar versionado basado en URL (el enfoque actual es correcto)
- Implementar headers sunset para endpoints deprecados
- Documentar política de cambios breaking

### 10.9 Ruta de Escalado de Base de Datos

**Actual:** Instancia única MySQL 8.0 con pool de conexiones.

**Fase 1 (100 tenants):** Réplicas de lectura para consultas de analíticas.
**Fase 2 (1000 tenants):** Sharding a nivel de aplicación por rangos de tenantId.
**Fase 3 (10000+ tenants):** Tenant por base de datos con enrutamiento de conexiones.

### 10.10 Evolución de Gestión de Estado Frontend

**Actual:** Zustand con persistencia en localStorage.

**Mejoras recomendadas:**
- Agregar React Query/TanStack Query para gestión de estado del servidor
- Implementar actualizaciones optimistas para mutaciones
- Agregar estados de carga/error adecuados con componentes skeleton
- Reemplazar `alert()` con sistema de notificaciones toast (react-hot-toast o sonner)

---

## APÉNDICE A: Archivos Auditados

### Controladores Backend (26)
analytics, auth, bulkPriceUpdate, cashShift, category, client, delivery, discount, ingredient, invoice, loyalty, modifier, order, paymentMethod, printRouting, printer, product, purchaseOrder, qr, role, stockAlert, stockMovement, supplier, sync, table, user

### Servicios Backend (35)
analytics, audit, auth, bulkPriceUpdate, businessDate, cashShift, category, delivery, discount, featureFlags, ingredient, invoice, kds, loyalty, marginConsent, modifier, order, orderDelivery, orderItem, orderKitchen, orderNumber, orderStatus, orderTransfer, orderVoid, paymentMethod, printRouting, printer, product, purchaseOrder, qr, stockAlert, stockMovement, supplier, sync, table

### Infraestructura Backend (16)
app.ts, server.ts, express-extensions.ts, order.types.ts, correlationId.ts, idempotency.ts, socket.ts, auth.routes.ts, order.routes.ts, client.routes.ts, config.routes.ts, inventory.routes.ts, schema.prisma, AdapterFactory.ts, PedidosYaAdapter.ts, webhookProcessor.ts

### Frontend (11)
App.tsx, auth.store.ts, api.ts, SocketContext.tsx, orderService.ts, tableService.ts, POSPage.tsx, TableDetailModal.tsx, LoginPage.tsx, SettingsPage.tsx, CategoryList.tsx

---

*Fin del Informe de Auditoría del Arquitecto Principal*
*Generado: 2026-01-31 | Auditor: Arquitecto Principal de Software Distinguido*
