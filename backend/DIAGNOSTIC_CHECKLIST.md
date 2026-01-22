# 🔍 CHECKLIST DE DIAGNÓSTICO: AMBIENTE DE ESTRÉS

## 1. ESTADO DE DOCKER

- [ ] Contenedor `benchmark_chaos` (Toxiproxy) está corriendo (`UP`).
- [ ] Contenedor `benchmark_app` (Node API) está corriendo (`UP`).
- [ ] Red interna `backend_default` conecta ambos contenedores.

## 2. CONECTIVIDAD (HOST -> CONTENEDOR)

- [ ] Puerto 8474 (API Toxiproxy) responde a `curl http://127.0.0.1:8474/version`.
- [ ] Puerto 3000 (API Directa) responde a `curl http://127.0.0.1:3000/api/v1/health` (si está mapeado).

## 3. CONFIGURACIÓN DE TOXIPROXY

- [ ] El script debe crear el proxy: `listen: "0.0.0.0:3001"`, `upstream: "benchmark_app:3000"`.
- [ ] El script debe inyectar el tóxico: `latency: 50ms`, `jitter: 20ms`.
- [ ] Verificación: `GET http://127.0.0.1:8474/proxies` debe mostrar el objeto JSON.

## 4. CONECTIVIDAD DE LA APP (A través del Proxy)

- [ ] Puerto 3001 responde a `curl http://127.0.0.1:3001/api/v1/health`.
- [ ] Si esto falla con "Socket Hang Up", el paso 3 falló.

## 5. REPORTE DE ERRORES RECIENTES

- [ ] `Invoke-WebRequest` falló por timeout (20s).
- [ ] Scripts usaban `localhost` en lugar de `127.0.0.1` (Corregido, pero hay que verificar).
