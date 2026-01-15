# 🛡️ PROTOCOLO DE DESARROLLO SEGURO (PDS) - v1.0

**Proyecto:** PentiumPOS - Roadmap Phase
**Objetivo:** Mantener estándares de ingeniería de grado "Enterprise" durante el escalamiento.

---

## 1. Los 5 Mandamientos del Código

1.  **Cero Tolerancia a N+1:**

    - Absolutamente PROHIBIDO realizar queries dentro de bucles (`for`, `map`).
    - _Solución:_ Usar `Promise.all` o queries con `WHERE IN (...)`.

2.  **Test First (o Test Immediately):**

    - Ninguna Feature se considera "Terminada" sin su correspondiente prueba E2E en Cypress.
    - Flujos críticos (Dinero, Inventario) requieren tests exhaustivos.

3.  **Tipado Estricto:**

    - Prohibido el uso de `any` explícito o implícito.
    - Las interfaces de Backend y Frontend deben estar sincronizadas (o compartir tipos si fuera monorepo).

4.  **Atomicidad de Estado:**

    - El estado global (Zustand) debe ser minimalista.
    - Usar `useMemo` y `useCallback` en componentes de alto tráfico (Context Providers, Listas largas).

5.  **Arquitectura Modular:**
    - El código nuevo debe respetar la estructura de carpetas `modules/`.
    - No agregar lógica de negocio en componentes de UI. Usar Hooks o Servicios.

---

## 2. Flujo de Trabajo (Workflow)

Para cada Ticket/Tarea del Roadmap:

1.  **Análisis:**

    - Identificar impacto en DB.
    - Verificar necesidad de Feature Flags (`TenantConfig`).

2.  **Implementación:**

    - Backend: Controller -> Service -> DB.
    - Frontend: Component -> Hook -> Service.

3.  **Verificación Local:**

    - Linting: `npm run lint`.
    - Build: `npm run build` (para detectar errores de tipos).

4.  **Testing E2E:**
    - Crear/Actualizar test en `frontend/cypress/e2e/`.
    - Verificar que pasa en CI local (`npm run cy:run`).

---

## 3. Checklist de Auditoría (Pre-Commit virtual)

- [ ] ¿He introducido un `useEffect` sin dependencias claras?
- [ ] ¿He modificado el Schema de Prisma? -> ¿Requiere migración?
- [ ] ¿Estoy exponiendo datos sensibles en logs?
- [ ] ¿El componente renderiza innecesariamente?

---

_Este protocolo es de cumplimiento obligatorio para proceder con el Roadmap._
