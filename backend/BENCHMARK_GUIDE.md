# 🧪 GUÍA DE INTERPRETACIÓN DEL BENCHMARK + REPORTE

Esta guía te ayuda a ejecutar la prueba, recolectar datos y entender por qué falla tu stack (si falla) bajo las restricciones de Hostinger KVM2.

## 📝 TABLA DE REPORTE DE RESULTADOS (Llénala durante la prueba)

Recolección de datos:

- Ejecuta `docker stats` en una terminal paralela.
- Observa los picos MÁXIMOS alcanzados.

| Métrica            | Valor Observado | Límite Hard      | Estado  |
| :----------------- | :-------------- | :--------------- | :------ |
| **App CPU Peak**   | `___ %`         | 120% (1.2 vCPU)  | 🟢 / 🔴 |
| **App RAM Peak**   | `___ MB`        | 2560 MB          | 🟢 / 🔴 |
| **DB CPU Peak**    | `___ %`         | 100% (1.0 vCPU)  | 🟢 / 🔴 |
| **DB RAM Peak**    | `___ MB`        | 4096 MB          | 🟢 / 🔴 |
| **Redis RAM Peak** | `___ MB`        | 512 MB           | 🟢 / 🔴 |
| **Latencia P95**   | `___ ms`        | Objetivo < 500ms | 🟢 / 🔴 |
| **RPS Sostenido**  | `___ req/s`     | Objetivo > 50    | 🟢 / 🔴 |
| **Errores**        | `___ %`         | Objetivo 0%      | 🟢 / 🔴 |

---

## 🕵️‍♂️ CÓMO INTERPRETAR LOS FALLOS (Análisis Forense)

### ESCENARIO A: CUELLO DE BOTELLA DE CPU (Node.js)

**Síntomas:**

1.  `benchmark_app` CPU pegada al **100% - 120%** constantemente.
2.  Latencia crece exponencialmente (de 100ms a 5s en segundos).
3.  Errores `502 Bad Gateway` o `Connection Timeout`.

**Diagnóstico:** El Event Loop de Node.js está bloqueado.
**Solución en Producción:**

- Escalar horizontalmente (más réplicas de Node).
- Optimizar código (remover cálculos pesados del hilo principal).
- Hostinger KVM2 (2 vCPU) podría quedarse corto si tienes lógica compleja.

### ESCENARIO B: CUELLO DE BOTELLA DE RAM (MySQL OOM)

**Síntomas:**

1.  `benchmark_db` desaparece súbitamente (`Exited (137)`).
2.  Docker logs muestra `Killed process (mysqld)`.
3.  La aplicación lanza errores de conexión a base de datos.

**Diagnóstico:** El sistema operativo mató a MySQL por falta de memoria (Out Of Memory Killer).
**Solución en Producción:**

- Reducir `innodb_buffer_pool_size`.
- Activar Swap (aunque es lento).
- **URGENTE:** Comprar plan superior (KVM4 o KVM8).

### ESCENARIO C: CUELLO DE BOTELLA DE I/O (Disco)

**Síntomas:**

1.  CPU de la DB baja (10-20%) pero latencia altísima.
2.  Alta métrica de "IOwait" (si se pudiera ver en el contenedor).

**Diagnóstico:** El disco no responde lo suficientemente rápido a las escrituras/lecturas.
**Solución:** Optimizar índices, reducir escrituras innecesarias.

---

## 🏃‍♂️ INSTRUCCIONES DE EJECUCIÓN

1. **Powershell** (Recomendado en Windows):

   ```powershell
   ./benchmark.ps1
   ```

2. **Monitoreo:**
   Abre otra terminal y corre:

   ```bash
   docker stats
   ```

3. **Ejecutar Carga:**
   (Si tienes k6 instalado)
   ```bash
   k6 run script.js
   ```
   (O usa tu script de Node simulado apuntando al puerto 3001)
   ```bash
   $env:DATABASE_URL="mysql://root:root@localhost:3306/control_gastronomico" # Ojo, DB interna en docker
   # NOTA: Para conectar a la DB desde fuera necesitarás exponer el puerto 3306 en el docker-compose si usas script externo.
   # El docker-compose actual NO expone 3306 para forzar tráfico "interno", pero para testing local puedes añadirlo.
   ```
