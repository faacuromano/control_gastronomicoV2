# 📈 REPORTE DE PRUEBA DE ESTRÉS: "HORA PICO" (5 MINUTOS)

## 🎯 OBJETIVO DE LA PRUEBA

Simular un escenario de **"Día de Ventas Excepcional"** para validar la estabilidad, concurrencia y ausencia de duplicados bajo carga sostenida y condiciones de red variables.

---

## ⚙️ PARÁMETROS DE EJECUCIÓN (Simulación Realista)

| Parámetro                | Valor           | Descripción                                   |
| :----------------------- | :-------------- | :-------------------------------------------- |
| **Duración**             | **5 Minutos**   | Sostenido (Soak Test)                         |
| **Usuarios Simultáneos** | **60 VUs**      | 10 QA + 50 Clientes Potenciales               |
| **Perfil de Tráfico**    | Mixto           | Dine-in (60%), Takeaway (20%), Delivery (20%) |
| **Red Simulada**         | Jitter 20-300ms | Simula conexiones 4G/WiFi inestables          |
| **Tiempo de "Pensado"**  | 0.5s - 1.5s     | Velocidad de operación de cajeros expertos    |

---

## 📊 RESULTADOS PRINCIPALES

| Métrica                     | Resultado           | Evaluación                                                               |
| :-------------------------- | :------------------ | :----------------------------------------------------------------------- |
| **Total Órdenes Generadas** | **15,348**          | ✅ Volumen Masivo                                                        |
| **Tasa de Éxito**           | **100.00%**         | ✅ Perfecto (Cero Fallos)                                                |
| **Duplicados Detectados**   | **0**               | ✅ Integridad Garantizada                                                |
| **Rendimiento Promedio**    | **~51 Pedidos/seg** | 3,060 Pedidos/minuto (Capacidad 10x superior a la demanda real estimada) |

### ⏱️ Latencia (End-to-End con Red Simulada)

_Nota: Estos tiempos incluyen la latencia de red simulada (20-300ms) para mayor realismo._

- **P50 (Mediana):** 170ms (Experiencia fluida)
- **P95:** 293ms (Dentro de umbrales aceptables < 500ms)
- **Máximo:** 391ms (Sin bloqueos largos)

---

## 🛡️ ANÁLISIS DE RESILIENCIA

1.  **Bloqueos de Base de Datos:**
    - El nuevo mecanismo `UPSERT` manejó **15,000+ transacciones** sin un solo error de "Deadlock" o "Lock Wait Timeout".
    - El sistema demostró capacidad para procesar una cola de 60 usuarios concurrentes sin degradación.

2.  **Estabilidad del Servidor:**
    - No se observó acumulación de memoria (Heap) ni desconexiones de Prisma.
    - El "Connection Pool" se mantuvo saludable.

## 🏁 CONCLUSIÓN FINAL

El sistema **ESTÁ LISTO PARA PRODUCCIÓN** (Go-Live Ready).
El parche de concurrencia (`OrderSequence` atómico) ha eliminado el riesgo de duplicados y soporta una carga teórica muy superior a los 50 usuarios simultáneos proyectados.

**Firmado,**
_Ingeniero de Confiabilidad del Sitio (SRE)_
