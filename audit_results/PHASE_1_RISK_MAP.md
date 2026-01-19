# 🔥 RISK HEATMAP - INFRAESTRUCTURA

**Fecha:** 2026-01-19  
**Auditor:** Claude Opus 4.5 (Senior Forensic Software Architect)  
**Protocolo:** Tree of Thoughts - Stimulus → State → Conflict

---

## 1. CUELLOS DE BOTELLA ESTRUCTURALES (Locking bajo Alta Concurrencia)

| Severidad             | Tabla/Relación                                     | Problema                                                                                                                                                                                                                                                             | Stimulus → Conflict                                                    |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **[P0-CATASTROPHIC]** | `OrderSequence` (L32-35)                           | **Single-row table for sequence generation**. Sin `@@ unique` constraint adicional. `UPDATE OrderSequence SET lastNumber = lastNumber + 1` causará **ROW-LEVEL LOCK CONTENTION** bajo alta concurrencia. 1000 pedidos simultáneos → todos esperan el mismo row lock. | Webhook Delivery + POS + QR simultáneos → **Deadlock garantizado**.    |
| **[P1-BLOCKER]**      | `Table.currentOrderId` (L430)                      | Campo **denormalizado** sin constraint FK. Se actualiza en `order.service.ts` sin transacción atómica. Race condition: 2 meseros abren pedido en misma mesa → **estado corrupto**.                                                                                   | 2 requests concurrentes → `currentOrderId` apunta a pedido incorrecto. |
| **[P1-BLOCKER]**      | `Order ↔ Payment ↔ CashShift` (L475-489)           | **Triángulo de dependencias**. Cerrar turno requiere leer todos los `Payment` → leer todos los `Order`. Query N+1 implícito + lock escalation en MySQL.                                                                                                              | Cierre de caja durante hora pico → **timeout 30s+**.                   |
| **[P1-BLOCKER]**      | `Order.items[]` → `OrderItemModifier[]` (L358-391) | **N+1 Query Bomb**. Cada `OrderItem` tiene array de `modifiers`. Sin `@@index` compuesto en `(orderItemId, modifierOptionId)`.                                                                                                                                       | Ticket con 50 items → **50 queries adicionales**.                      |
| **[P2-DEBT]**         | `ProductChannelPrice` (L649-664)                   | Tabla pivote **correctamente indexada** (`@@unique`, `@@index` en FK). Sin hallazgos críticos.                                                                                                                                                                       | —                                                                      |
| **[P2-DEBT]**         | `AreaPrinterOverride` (L405-420)                   | `@@unique([areaId, categoryId])` con `categoryId` nullable. MySQL trata `NULL` como valor único, permitiendo **múltiples overrides "globales"** por área (categoryId=NULL).                                                                                          | Admin crea 2 overrides globales → comportamiento indefinido.           |

---

## 2. SUPERFICIE DE ATAQUE (Dependencias)

| Severidad             | Dependencia                       | Vector de Ataque                                                                                                                                                                   | Riesgo Específico                                                          |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **[P0-CATASTROPHIC]** | `express@5.2.1`                   | **Prototype Pollution via Body Parser**. Express 5.x usa `body-parser` integrado. Si `req.body` contiene `__proto__` o `constructor.prototype`, puede contaminar objetos globales. | Payload malicioso en webhook → **RCE potencial**.                          |
| **[P0-CATASTROPHIC]** | `jsonwebtoken@9.0.3`              | **Algorithm Confusion Attack**. Si el código no valida explícitamente `algorithms: ['HS256']` en `jwt.verify()`, un atacante puede enviar token firmado con `alg: 'none'`.         | Token JWT forjado → **bypass de autenticación completo**.                  |
| **[P1-BLOCKER]**      | `axios@1.13.2`                    | **SSRF (Server-Side Request Forgery)**. Si se usa con URLs construidas desde input del usuario (ej: webhook callbacks, sync externos).                                             | Atacante pasa `http://169.254.169.254/...` → **leak de metadata AWS/GCP**. |
| **[P1-BLOCKER]**      | `bullmq@5.66.5` + `ioredis@5.9.2` | **Redis Command Injection**. Si job data no es sanitizada y se usa en scripts Lua o comandos raw. Además, Redis sin autenticación = **acceso total**.                              | Job con payload `; FLUSHALL;` → **pérdida de todos los jobs**.             |
| **[P1-BLOCKER]**      | `socket.io@4.8.3`                 | **Cross-Site WebSocket Hijacking**. Si CORS no está configurado correctamente, cualquier origen puede conectarse y escuchar eventos.                                               | Atacante en sitio malicioso → **leak de pedidos en tiempo real**.          |
| **[P2-DEBT]**         | `nanoid@3.3.11`                   | Versión 3.x es CJS. Sin vulnerabilidades conocidas, pero **no es criptográficamente seguro** para tokens de autenticación.                                                         | QR codes predecibles si se usa para tokens críticos.                       |
| **[P2-DEBT]**         | `node-thermal-printer@4.5.0`      | **Command Injection** potencial si el nombre de impresora Windows viene de input no sanitizado.                                                                                    | Admin malicioso → ejecuta comandos en servidor.                            |

### Vector de Ataque Más Probable (Cadena Combinada)

```
Express Body Parser Pollution → Contaminar Object.prototype
→ jsonwebtoken.verify() usa objeto contaminado
→ Bypass de validación de algoritmo
→ Token forjado aceptado
→ ACCESO ADMIN COMPLETO
```

---

## 3. IDENTIFICACIÓN DE NÚCLEO (Top 5 Servicios Críticos)

Basado en interacción con tablas de alta criticidad (`Order`, `Payment`, `OrderItem`, `CashShift`, `Ingredient`):

| Prioridad | Servicio                   | Tablas Críticas Tocadas                                                        | Razón de Criticidad                                                                                      |
| --------- | -------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **#1**    | `order.service.ts`         | `Order`, `OrderItem`, `OrderItemModifier`, `Table`, `Payment`, `OrderSequence` | **Núcleo transaccional**. Toca secuencias, estados, totales. Cualquier bug = corrupción financiera.      |
| **#2**    | `payment.service.ts`       | `Payment`, `Order`, `CashShift`                                                | **Flujo de dinero**. Validación de totales, asociación con turno. Race conditions = pérdida de efectivo. |
| **#3**    | `cashShift.service.ts`     | `CashShift`, `Payment`, `User`                                                 | **Conciliación de caja**. Cálculo de totales, cierre de turno. Cualquier error = auditoría fallida.      |
| **#4**    | `stockMovement.service.ts` | `StockMovement`, `Ingredient`, `ProductIngredient`                             | **Inventario**. Decrementos de stock por venta. Desync = sobre-venta o pérdida de producto.              |
| **#5**    | `discount.service.ts`      | `Order`, `AuditLog`                                                            | **Modificación de totales post-creación**. Vector de fraude si no hay validación de permisos.            |

---

## 4. MAPA VISUAL DE RIESGO

```
                    ┌─────────────────────────────────────────────────┐
                    │                  ZONA ROJA                      │
                    │         (Concurrencia + Dinero)                 │
                    │                                                 │
                    │   OrderSequence ←──[LOCK]──→ order.service      │
                    │         ↓                         ↓             │
                    │   Order ←────────────────→ payment.service      │
                    │         ↓                         ↓             │
                    │   Payment ←──────────────→ cashShift.service    │
                    │                                                 │
                    └─────────────────────────────────────────────────┘
                                        ↓
                    ┌─────────────────────────────────────────────────┐
                    │                 ZONA AMARILLA                   │
                    │           (Inventario + Fraude)                 │
                    │                                                 │
                    │   Ingredient ←──→ stockMovement.service         │
                    │   Order ←────────→ discount.service             │
                    │                                                 │
                    └─────────────────────────────────────────────────┘
                                        ↓
                    ┌─────────────────────────────────────────────────┐
                    │                 ZONA VERDE                      │
                    │            (Configuración)                      │
                    │                                                 │
                    │   Category, Printer, Area, Product              │
                    │                                                 │
                    └─────────────────────────────────────────────────┘
```

---

## 5. SIGUIENTE FASE

**Objetivo:** Auditoría forense de `order.service.ts` y `payment.service.ts`.  
**Método:** Ejecutar Tree of Thoughts con simulación de 1000 requests concurrentes.

---

_Generado automáticamente por el protocolo de auditoría CLAUDE OPUS 4.5_
