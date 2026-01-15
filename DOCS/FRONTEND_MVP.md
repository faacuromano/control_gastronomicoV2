# 🎨 Frontend MVP - PentiumPOS (Actualizado)

**Objetivo:** Interfaz funcional "Core" preparada para escalar.
**Stack:** React 18+, TailwindCSS, Shadcn/UI, **Zustand** (state management).
**Consistencia:** Alineado 100% con `PRISMA_SCHEMA.MD` y `BACKEND_MVP.md`.

---

## 📋 Scope del MVP

### ✅ Pantallas Activas (Core)

- **Login:** Email/Password (y preparado para PIN en UI). [IMPLEMENTADO]
- **POS (Punto de Venta):** Grid de productos, Carrito, Layout responsive, integración completa con Backend (API de productos, órdenes, pagos, turnos de caja). [IMPLEMENTADO]
- **Admin Básico:** ABM de Productos y Categorías. [IMPLEMENTADO]
- **Caja:** Apertura/Cierre de turnos con Arqueo Ciego. [IMPLEMENTADO]

### ❌ UI Oculta (Feature Flags)

Si `TenantConfig.enableStock === false`, las opciones de inventario no se muestran en el Sidebar.
Lo mismo para Delivery y Tables.

---

## 🏗️ State Management: Zustand 100%

Para evitar la deuda técnica de mezclar Context API con Zustand, usaremos **Zustand** para todo estado global mutable.

### Store de Autenticación (`useAuthStore`) [IMPLEMENTADO]

Maneja usuario y token. Persiste en Cookies ( HttpOnly gestionado por backend) pero mantiene estado reactivo.

```typescript
interface AuthState {
  user: User | null; // El User completo con Role y Permissions
  login: (credentials) => Promise<void>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
}
```

### Store de Carrito (`usePOSStore`) [IMPLEMENTADO]

Maneja la orden en curso localmente antes de enviar al backend.

```typescript
interface CartItem {
  product: Product;
  quantity: number;
  modifiers: ModifierSelection[]; // Preparado para el futuro
}
```

### Store de Configuración (`useConfigStore`)

Carga el `TenantConfig` al inicio y decide qué módulos mostrar.

```typescript
if (!config.enableStock) return null; // Componente de Stock se oculta
```

---

## 🗓️ Sprints de Implementación

### Sprint F1: Foundation & Auth (✅ Completado)

- [x] Setup de Tailwind + Shadcn.
- [x] Implementar `useAuthStore` conectado a los endpoints reales de Auth (JWT).
- [x] Login Page.
- [x] Layout con Sidebar dinámico (oculta items según permisos/flags).

### Sprint F2: Admin Catalog (Core) (✅ Completado)

- [x] Layout principal con Sidebar
- [x] Gestión de Categorías
- [x] Gestión de Productos
- **Diferencia clave:** Al crear producto, el form debe guardar `productType: SIMPLE` por defecto, pero la UI debe estar lista para mostrar tabs de "Receta" si se habilitara el módulo en el futuro.

### Sprint F3: POS Interface (Critical) (✅ Completado)

- [x] **Requisito de Performance:** El POS no puede tener lag.
- [x] Grid de productos con filtros de categoría.
- [x] Carrito lateral fijo.
- [x] Modal de Checkout (Pagos múltiples).
- [x] Integration con `CashShift`: Si no hay turno abierto, bloquear venta.

### Sprint F4: Caja (✅ Completado)

- [x] Modal de apertura de turno (`OpenShiftModal.tsx`).
- [x] Modal de cierre con Arqueo Ciego (`CloseShiftModal.tsx`).
- [ ] Dashboard de turno actual con stats en tiempo real (Mejora futura).

---

## 📁 Estructura de Directorios (Modular)

Mantenemos la estructura por dominio para consistencia con Backend:

```
src/
  modules/
    core/
      auth/          # Auth components & stores
      ui/            # Shared UI elements
    pos/
      components/    # ProductGrid, Cart, CheckoutModal
      hooks/         # Lógica específica de POS
    admin/
      products/      # Forms y tablas de producto
      finance/       # Gestión de caja
```
