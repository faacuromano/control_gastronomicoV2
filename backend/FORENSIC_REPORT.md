# 🕵️‍♂️ REPORTE DE AUDITORÍA FORENSE: GENERACIÓN DE NÚMERO DE PEDIDO

## 🚨 RESUMEN EJECUTIVO

**Estado:** [FALLIDO] ❌
**Severidad:** [P0-CATASTRÓFICO]
**Conclusión:** El sistema **NO ES RESILIENTE** ante eventos de "Estampida" (Thundering Herd).

Durante las pruebas de carga forenses, se **confirmaron números de pedido duplicados**. Esto significa que, bajo alta carga, a dos o más clientes se les asignó el mismo Número de Pedido, lo que conduciría a corrupción de datos crítica, errores de facturación y caos operativo.

---

## 🔬 HALLAZGOS TÉCNICOS

### 1. 🛑 FALLO CRÍTICO: Condición de Carrera Confirmada

La implementación de `OrderNumberService.getNextSequenceNumber` es vulnerable a condiciones de carrera a pesar de usar `SELECT ... FOR UPDATE`.

- **Evidencia:** En la Prueba #1 (100 usuarios concurrentes), el sistema falló con `CRITICAL FAILURE: DUPLICATE ORDER NUMBERS DETECTED` (Fallo Crítico: Números de Pedido Duplicados Detectados).
- **Análisis de Causa Raíz:**
  - **Vulnerabilidad de "Hueco" (Gap):** La lógica verifica si existe una fila de secuencia. Si no existe (ej. el primer pedido de la hora), múltiples hilos intentan ejecutar `create` simultáneamente. Uno tiene éxito; los otros fallan o generan duplicados debido a la ventana de tiempo entre la verificación y la inserción.
  - **Alcance del Bloqueo:** El patrón `SELECT ... FOR UPDATE` es generalmente seguro para _actualizaciones_ en filas existentes, pero no protege adecuadamente contra lecturas fantasma (phantom reads) o inserciones concurrentes en el nivel de aislamiento predeterminado (`Read Committed`) para garantizar la seguridad en la creación de nuevas filas sin un manejo de restricciones único.

### 2. 📉 ANÁLISIS DE CAPACIDAD (Hostinger KVM2)

**Benchmark del Entorno de Pruebas:**

- **Hardware:** Máquina Local (Rendimiento superior al KVM2 estimado)
- **Rendimiento:** ~400 Solicitudes/Segundo (sostenido)
- **Latencia (Secuencial):** 25-30ms por ciclo de bloqueo.

**Proyecciones para Hostinger KVM2 (2 vCPU, 8GB RAM):**

- **Rendimiento Teórico Máximo:** ~300-350 TPS (Transacciones Por Segundo).
- **¿Por qué?** El cuello de botella es el **Bloqueo de Fila de la Base de Datos**. No importa cuánta RAM agregues, las solicitudes _deben_ serializarse para incrementar el contador.
- **Impacto de "Estampida":**
  - Si **1,000 usuarios** presionan el botón "Completar Pedido" en el mismo segundo exacto:
    - El usuario número 1000 esperará aprox. **3.0 - 4.0 segundos**.
    - Esto es _aceptable_ para un paso de procesamiento de pago, pero el **bucle de eventos de Node.js (event loop) sufrirá retrasos** significativos.

---

## 🛠 RECOMENDACIONES

### ✅ CORRECCIONES INMEDIATAS (P0)

1.  **Cambiar al Patrón UPSERT:**
    Reemplazar la lógica de "Verificar-luego-Insertar" con una operación atómica refinada.

    _Enfoque SQL Recomendado (Postgres):_

    ```sql
    INSERT INTO "OrderSequence" ("sequenceKey", "currentValue")
    VALUES ('2025012110', 1)
    ON CONFLICT ("sequenceKey")
    DO UPDATE SET "currentValue" = "OrderSequence"."currentValue" + 1
    RETURNING "currentValue";
    ```

    Esto elimina la necesidad de gestión explícita de `SELECT FOR UPDATE` y maneja la condición de carrera de "nueva fila" atómicamente a nivel de BD.

2.  **Lógica de Reintento:**
    Implementar un envoltorio de reintento alrededor de la lógica de generación. Si ocurre un bloqueo mortal (deadlock) o error de concurrencia, reintentar 3 veces con espera exponencial (backoff).

### ⚠️ INFRAESTRUCTURA (P2)

- **Hostinger KVM2 es Suficiente** para ~300 pedidos concurrentes/segundo (Límite atómico de BD).
- **Advertencia:** Si esperas >500 pedidos/seg, **no puedes** usar una secuencia de bloqueo de fila única. Necesitarías:
  - IDs Snowflake (Estilo Twitter) - No secuenciales pero únicos.
  - Bloques de pre-asignación (Worker 1 reserva IDs 1000-1100).

---

## 📊 ARTEFACTOS DE DATOS DE PRUEBA

- `load_test_failure.log`: Evidencia de duplicados a 100 de concurrencia.
- `load_test_1000.txt`: Generación secuencial exitosa a 1000 de concurrencia (tras calentamiento).
- **Verificación de Integridad:** La base de datos mantiene con éxito ~1600 secuencias generadas en las ejecuciones exitosas.

**Firmado,**
_Arquitecto de Software Forense Senior_
