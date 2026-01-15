# 🚀 Backend MVP - PentiumPOS (Actualizado)

**Objetivo:** Sistema POS "Core" funcional sobre arquitectura final.
**Stack:** Node.js + Express, Prisma ORM, MySQL, TypeScript.
**Filosofía:** "Modular Monolith". El schema es completo desde el día 1, pero los módulos avanzados (Stock, Delivery) están desactivados por configuración (`TenantConfig`).

---

## 📋 Scope del MVP

El MVP no es un "código descartable", es la **Fase 1** del sistema final.

### ✅ Módulos Activos (Core) [IMPLEMENTADOS]

- **Auth:** Login/Logout, Roles (RBAC completo según DB), Gestión de usuarios.
- **Menu:** Categorías, Productos (Soporte inicial para Modificadores básicos).
- **Sales:** Creación de Órdenes, POS, Pagos (Efectivo/Tarjeta/Transferencia).
- **Inventory:** Ingredientes y Stock Movements con Deducción automática al vender recetas.

### 💤 Módulos Latentes (Base de Datos lista, Lógica inactiva)

Están definidos en BD pero sus features flags (`enableStock`, `enableDelivery`) estarán en `false` o latentes.

- **Delivery:** Tablas `Client`, `Driver` existen pero no se usan en el flujo POS.
- **KDS:** Enrutamiento de impresoras preparado en DB, pero sin UI de cocina.

---

## 🛠 Schema Prisma

**REFERENCIA ÚNICA:** Ver `PRISMA_SCHEMA.MD` para la definición oficial.

> ⚠️ **IMPORTANTE:** No crear schemas paralelos o simplificados. Usar el schema completo para evitar migraciones destructivas a futuro.

---

## 🏗️ Arquitectura de Feature Flags

El backend debe consultar `TenantConfig` para habilitar comportamientos.

```typescript
// services/order.service.ts

export async function createOrder(data: OrderInput) {
    return await prisma.$transaction(async (tx) => {
        // 1. Crear la orden (SIEMPRE)
        const order = await tx.order.create({ ... });

        // 2. Verificar FLAGS para módulos opcionales
        const config = await getConfig(tx);

        if (config.enableStock) {
            // Este código NO corre en el MVP inicial si el flag es false
            await stockService.decrementStock(tx, order.items);
        }

        if (config.enableKDS) {
            await kdsService.notifyKitchen(order);
        }

        return order;
    });
}
```

---

## 🗓️ Sprint Path (MVP)

### Sprint 0: Foundation Real (✅ Completado)

- **Objetivo:** Setup del proyecto con el **SCHEMA COMPLETO**.
- **Tareas:**
  1.  Init Node.js + Express + TypeScript.
  2.  Configurar Prisma con MySQL.
  3.  Aplicar `PRISMA_SCHEMA.MD` (migración inicial).
  4.  Seeds para `Role` (Admin, Cajero, Mozo, Cocina) con sus permisos JSON.
  5.  Seed para `TenantConfig` (flags en `false`).

### Sprint 1: Auth Robusto (RBAC) (✅ Completado)

- **Objetivo:** Sistema de usuarios usando tabla `Role`.
- **Tareas:**
  1.  Login con JWT.
  2.  Middleware que lea `user.role.permissions` (aunque el MVP sea simple, la estructura debe estar).
  3.  Endpoints:
      - `POST /api/auth/login/pin` (POS).
      - `POST /api/auth/login` (Email/Pass).
      - `POST /api/auth/register` (Usuario inicial).

### Sprint 2: Menu System (✅ Completado)

- **Objetivo:** CRUD Productos y Categorías.
- **Diferencia vs MVP anterior:**
  - Los productos tienen campo `productType` (SIMPLE/COMBO/RECIPE) aunque por ahora solo usemos SIMPLE.
  - Categorías tienen campo `printerId` (nullable) listo para el futuro.

### Sprint 3: POS & Orders Core (✅ Completado)

- **Objetivo:** Venta mostrador.
- **Flujo:**
  1.  Crear Orden (`channel: POS`).
  2.  Validar turno de caja abierto (`CashShift`).
  3.  Registrar Pago.
  4.  Cerrar Orden.
  5.  **Nota:** El campo `businessDate` debe llenarse calculando el "Día Operativo" (ej: si son las 01:00 AM, sigue siendo el día anterior).

### Sprint 4: Finance (Caja) (✅ Completado)

- **Objetivo:** Control de dinero.
- **Feature:** Arqueo ciego implementado.
- **Dato Clave:** `CashShift` respeta el `businessDate` para reportes coherentes.

---

## 🧪 Estrategia de Testing MVP

- **Unit Tests:** Validar lógica de cálculo de totales.
- **Integration Tests:** Validar que al crear una orden con `enableStock: false`, NO fallé por falta de ingredientes.
