# 📋 Estado Actual del Producto - ACTUALIZADO 18/01/2026

## CAMBIOS DESDE ÚLTIMA AUDITORÍA

> [!IMPORTANT]
> Este documento refleja el estado post-Sprint A (Hardening) y post-Sprint B (Operaciones).
> La completitud global pasó de **38% → 55%**.

---

## ✅ Items Corregidos (Sprint A + B)

### Seguridad

- **Rate Limiting:** 5 intentos/15 min (antes: 1000)
- **Account Lockout:** 5 intentos fallidos → 15 min bloqueo
- **JWT Entropy Validation:** Mínimo 32 caracteres + weak secret check
- **Console.log eliminados:** Migrado a Winston logger estructurado

### Transacciones Atómicas

- **Loyalty Points:** Ahora DENTRO de $transaction
- **Stock Updates:** Atómico con creación de orden

### Operaciones Core

- **Void Items:** `orderVoid.service.ts` - 217 líneas, reversión stock + audit
- **Descuentos:** `discount.service.ts` - 267 líneas, % y fijo + autorización
- **Transferencia Items:** `orderTransfer.service.ts` - 242 líneas, entre mesas
- **Audit Trail:** `audit.service.ts` + modelo AuditLog completo
- **Propinas:** Campo `tip` en modelo Order

### Sprint B Operaciones Enterprise

- **Loyalty en Checkout:** Integrado en CheckoutModal.tsx
- **Print Routing:** Estilo Toast, routing por categoría + overrides área
- **Stock Alerts:** WebSocket tiempo real + badge en Header
- **Modifier Validation:** Mensaje específico de grupos faltantes

---

## ⚠️ Gaps Pendientes Críticos

| Gap                       | Status      | Próximo Sprint |
| ------------------------- | ----------- | -------------- |
| Modo Offline              | 0%          | Sprint C       |
| Facturación AFIP          | 5%          | Sprint D       |
| Integración Delivery Apps | Solo schema | Post-D         |

---

## 📊 Completitud Actualizada

| Módulo           | % Completitud |
| ---------------- | ------------- |
| Auth & RBAC      | 95%           |
| POS Core         | 75%           |
| Void/Descuentos  | 90%           |
| Mesas (Transfer) | 70%           |
| Inventario       | 60%           |
| Impresión        | 60%           |
| Analytics        | 35%           |
| Facturación      | 5%            |
| Offline          | 0%            |

**GLOBAL: 55%**
