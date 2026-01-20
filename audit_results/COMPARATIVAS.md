# 📊 Análisis Comparativo - Competidores POS Gastronómico

**Fecha de Análisis:** Enero 2026  
**Propósito:** Identificar fortalezas a adoptar y oportunidades de diferenciación

---

## Matriz Comparativa

| Sistema | Fortaleza Principal | Debilidad | Funcionalidad a Adoptar |
|---------|---------------------|-----------|-------------------------|
| **Maxirest** | Robustez Fiscal y Offline. Funciona aunque se caiga internet o el mundo. Gestión de stock ultra granular. | UX antigua, costoso, difícil de configurar | **Modo Offline & Auditoría:** El sistema no puede depender de internet al 100% |
| **Woki / Nocueloit** | Integraciones & QR. Pedidos desde la mesa (Autoservicio), integración directa con Rappi/PeYa | Menos control de "merma" y recetas complejas | **Menú Digital / QR:** El cliente pide solo. **KDS:** Pantalla de Cocina |
| **Citynet / Otros** | Local/Específico. Suelen ser fuertes en nichos geográficos | Poca escalabilidad | **Arquitectura Modular:** Poder activar/desactivar módulos según el cliente |

---

## Decisiones Estratégicas Derivadas

### De Maxirest:
- ✅ Implementar **modo offline** básico (queue de operaciones)
- ✅ **Auditoría inmutable** de todas las operaciones críticas
- ✅ Control granular de **merma y stock**

### De Woki / Nocueloit:
- ✅ **KDS (Kitchen Display System)** desde el diseño inicial
- ✅ Preparar arquitectura para **integraciones delivery** (PedidosYa, Rappi)
- ⏳ Menú QR self-ordering (Fase 2)

### De Citynet / Otros:
- ✅ **Feature Flags** para activar/desactivar módulos
- ✅ Escalar desde Food Truck hasta restaurante multi-piso

---

## Nuestra Diferenciación Clave

> **"Arquitectura Modular Desactivable"**  
> El mismo código base sirve para todos los tamaños de negocio.

| Tipo de Negocio | Módulos Activos |
|-----------------|-----------------|
| Food Truck | Core (POS + Caja) |
| Bar | Core + Mesas |
| Restaurante | Core + Mesas + Stock + KDS |
| Dark Kitchen | Core + Stock + Delivery |