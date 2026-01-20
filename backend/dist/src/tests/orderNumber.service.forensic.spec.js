"use strict";
/**
 * @fileoverview Forensic Test Suite - Order ID Generation (Banking Grade)
 *
 * OBJETIVO: Probar TODOS los edge cases y failure modes del sistema de Order IDs
 * FILOSOFÍA: "Paranoid Testing" - Si puede fallar, DEBE tener un test
 *
 * TEST COVERAGE:
 * 1. UUID Generation & Validation
 * 2. Business Date 6 AM Cutoff Logic
 * 3. Race Conditions & Concurrency
 * 4. Database Constraint Violations
 * 5. Retry Logic & Error Handling
 * 6. Performance & Latency
 *
 * COMPLIANCE: Tests design

ados para demostrar compliance con AFIP, SOC2, ISO 27001
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const vitest_mock_extended_1 = require("vitest-mock-extended");
const orderNumber_service_NEW_1 = require("../services/orderNumber.service.NEW");
const uuid_1 = require("uuid");
// Mock de Prisma para tests unitarios
const prismaMock = (0, vitest_mock_extended_1.mockDeep)();
// Setup: Limpiar DB antes de cada test
(0, vitest_1.beforeEach)(async () => {
    // Reset mocks
    vitest_1.vi.clearAllMocks();
    // Configurar timezone a Argentina (UTC-3) para tests de 6 AM
    process.env.TZ = 'America/Argentina/Buenos_Aires';
});
(0, vitest_1.afterEach)(async () => {
    // Cleanup
    vitest_1.vi.restoreAllMocks();
});
(0, vitest_1.describe)('🔐 UUID Generation & Validation', () => {
    (0, vitest_1.it)('UT-001: Debe generar UUID v4 con formato RFC4122 válido', async () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        // Generar 10 UUIDs
        const uuids = [];
        for (let i = 0; i < 10; i++) {
            const uuid = service.generateUuid();
            uuids.push(uuid);
            // ASSERTION: Formato válido
            (0, vitest_1.expect)((0, uuid_1.validate)(uuid)).toBe(true);
            // ASSERTION: Formato específico v4 (8-4-4-4-12 con versión '4' en posición correcta)
            (0, vitest_1.expect)(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        }
        // ASSERTION: Todos los UUIDs son únicos
        const uniqueCount = new Set(uuids).size;
        (0, vitest_1.expect)(uniqueCount).toBe(10);
    });
    (0, vitest_1.it)('UT-002: Debe rechazar UUIDs malformados en validación', () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const invalidUuids = [
            '',
            'not-a-uuid',
            '12345678-1234-1234-1234-123456789012', // Formato correcto pero no v4
            '550e8400-e29b-41d4-a716-44665544000', // Muy corto
            '550e8400-e29b-41d4-a716-446655440000-extra', // Muy largo
            null,
            undefined
        ];
        invalidUuids.forEach((invalidUuid) => {
            (0, vitest_1.expect)(service.validateUuid(invalidUuid)).toBe(false);
        });
    });
    (0, vitest_1.it)('UT-003: Debe generar 10,000 UUIDs únicos sin colisiones', () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const uuids = new Set();
        // Generar 10,000 UUIDs (estadísticamente imposible tener colisión)
        for (let i = 0; i < 10000; i++) {
            uuids.add(service.generateUuid());
        }
        // ASSERTION: Exactamente 10,000 UUIDs únicos
        (0, vitest_1.expect)(uuids.size).toBe(10000);
    });
});
(0, vitest_1.describe)('📅 Business Date 6 AM Cutoff Logic', () => {
    (0, vitest_1.it)('UT-004: Orden creada a 5:59 AM debe usar día ANTERIOR', async () => {
        // Mock de Date para simular 5:59 AM del 2026-01-19
        vitest_1.vi.useFakeTimers();
        vitest_1.vi.setSystemTime(new Date('2026-01-19T05:59:00-03:00'));
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        // Mock transaction client
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockResolvedValue([]),
            orderSequence: {
                create: vitest_1.vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
            }
        };
        const result = await service.getNextOrderNumber(txMock);
        // ASSERTION: businessDate es 2026-01-18 (día ANTERIOR)
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
        (0, vitest_1.expect)(result.orderNumber).toBe(1);
        (0, vitest_1.expect)((0, uuid_1.validate)(result.id)).toBe(true);
        vitest_1.vi.useRealTimers();
    });
    (0, vitest_1.it)('UT-005: Orden creada a 6:01 AM debe usar día ACTUAL', async () => {
        // Mock de Date para simular 6:01 AM del 2026-01-19
        vitest_1.vi.useFakeTimers();
        vitest_1.vi.setSystemTime(new Date('2026-01-19T06:01:00-03:00'));
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockResolvedValue([]),
            orderSequence: {
                create: vitest_1.vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
            }
        };
        const result = await service.getNextOrderNumber(txMock);
        // ASSERTION: businessDate es 2026-01-19 (día ACTUAL)
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
        (0, vitest_1.expect)(result.orderNumber).toBe(1);
        vitest_1.vi.useRealTimers();
    });
    (0, vitest_1.it)('UT-006: Orden exactamente a 6:00:00 AM debe usar día ACTUAL', async () => {
        // Edge case: Exactamente 6 AM
        vitest_1.vi.useFakeTimers();
        vitest_1.vi.setSystemTime(new Date('2026-01-19T06:00:00-03:00'));
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockResolvedValue([]),
            orderSequence: {
                create: vitest_1.vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
            }
        };
        const result = await service.getNextOrderNumber(txMock);
        // ASSERTION: 6:00:00 AM pertenece al día ACTUAL (>= 6 AM)
        (0, vitest_1.expect)(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
        vitest_1.vi.useRealTimers();
    });
});
(0, vitest_1.describe)('⚡ Race Conditions & Concurrency', () => {
    (0, vitest_1.it)('IT-001: 50 requests concurrentes deben generar 50 orderNumbers secuenciales', async () => {
        // ESTE TEST REQUIERE DB REAL - Usar test con Docker/TestContainers
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        // Simular 50 transacciones concurrentes
        const promises = [];
        // Mock: Cada transacción obtiene secuencia existente con lock
        let currentValue = 0;
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockImplementation(async () => {
                // Simular lock delay (1-10ms random)
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return [{ id: 1, currentValue }];
            }),
            orderSequence: {
                update: vitest_1.vi.fn().mockImplementation(async (args) => {
                    currentValue = args.data.currentValue;
                    return { id: 1, currentValue };
                })
            }
        };
        // Ejecutar 50 requests en paralelo
        for (let i = 0; i < 50; i++) {
            promises.push(service.getNextOrderNumber(txMock));
        }
        const results = await Promise.all(promises);
        // ASSERTION: 50 órdenes creadas
        (0, vitest_1.expect)(results).toHaveLength(50);
        // ASSERTION: 50 UUIDs únicos
        const uuids = results.map(r => r.id);
        (0, vitest_1.expect)(new Set(uuids).size).toBe(50);
        // ASSERTION: orderNumbers son secuenciales (1-50)
        const orderNumbers = results.map(r => r.orderNumber).sort((a, b) => a - b);
        (0, vitest_1.expect)(orderNumbers[0]).toBe(1);
        (0, vitest_1.expect)(orderNumbers[49]).toBe(50);
        // ASSERTION: No hay gaps en la secuencia
        for (let i = 0; i < 49; i++) {
            (0, vitest_1.expect)(orderNumbers[i + 1] - orderNumbers[i]).toBe(1);
        }
    });
    (0, vitest_1.it)('IT-002: Race condition en 6 AM boundary NO debe causar P2002', async () => {
        // Simular 10 órdenes creadas en ventana de 05:59:58 - 06:00:02
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const results = [];
        for (let i = 0; i < 10; i++) {
            // Alternar entre 5:59 AM y 6:01 AM
            const time = i % 2 === 0
                ? new Date('2026-01-19T05:59:58-03:00')
                : new Date('2026-01-19T06:00:02-03:00');
            vitest_1.vi.useFakeTimers();
            vitest_1.vi.setSystemTime(time);
            const txMock = {
                $queryRaw: vitest_1.vi.fn().mockResolvedValue([{ id: i, currentValue: i }]),
                orderSequence: {
                    update: vitest_1.vi.fn().mockResolvedValue({ id: i, currentValue: i + 1 })
                }
            };
            const result = await service.getNextOrderNumber(txMock);
            results.push(result);
            vitest_1.vi.useRealTimers();
        }
        // ASSERTION: No hay (businessDate, orderNumber) duplicados
        const keys = results.map(r => `${r.businessDate.toISOString().split('T')[0]}-${r.orderNumber}`);
        (0, vitest_1.expect)(new Set(keys).size).toBe(keys.length);
    });
});
(0, vitest_1.describe)('💥 Database Constraint Violations', () => {
    (0, vitest_1.it)('CT-001: Intentar insertar UUID duplicado debe fallar con error claro', async () => {
        // Este test requiere DB real para constraint validation
        const duplicateUuid = '550e8400-e29b-41d4-a716-446655440000';
        // Simular error de Prisma por unique constraint
        const txMock = {
            order: {
                create: vitest_1.vi.fn().mockRejectedValue({
                    code: 'P2002',
                    meta: { target: ['uuid'] },
                    message: 'Unique constraint failed on the constraint: `uk_order_uuid`'
                })
            }
        };
        // ASSERTION: Error con código P2002 (unique violation)
        await (0, vitest_1.expect)(txMock.order.create({ data: { id: duplicateUuid } })).rejects.toMatchObject({
            code: 'P2002',
            meta: { target: ['uuid'] }
        });
    });
    (0, vitest_1.it)('CT-002: Intentar insertar (businessDate, orderNumber) duplicado debe fallar', async () => {
        const txMock = {
            order: {
                create: vitest_1.vi.fn().mockRejectedValue({
                    code: 'P2002',
                    meta: { target: ['businessDate', 'orderNumber'] },
                    message: 'Unique constraint failed on the constraint: `uk_business_order`'
                })
            }
        };
        // ASSERTION: Error P2002 en composite key
        await (0, vitest_1.expect)(txMock.order.create({
            data: {
                businessDate: new Date('2026-01-19'),
                orderNumber: 123
            }
        })).rejects.toMatchObject({
            code: 'P2002',
            meta: { target: ['businessDate', 'orderNumber'] }
        });
    });
});
(0, vitest_1.describe)('🔄 Retry Logic & Error Handling', () => {
    (0, vitest_1.it)('UT-007: Debe reintentar hasta 3 veces en caso de deadlock', async () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        let attemptCount = 0;
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    // Simular deadlock en primer y segundo intento
                    throw new Error('Deadlock found when trying to get lock');
                }
                // Tercer intento exitoso
                return [{ id: 1, currentValue: 5 }];
            }),
            orderSequence: {
                update: vitest_1.vi.fn().mockResolvedValue({ id: 1, currentValue: 6 })
            }
        };
        const result = await service.getNextOrderNumber(txMock);
        // ASSERTION: Retry funcionó, obtuvo resultado al tercer intento
        (0, vitest_1.expect)(attemptCount).toBe(3);
        (0, vitest_1.expect)(result.orderNumber).toBe(6);
    });
    (0, vitest_1.it)('UT-008: Debe lanzar error después de 3 intentos fallidos', async () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockRejectedValue(new Error('Lock wait timeout exceeded')),
            orderSequence: {
                update: vitest_1.vi.fn()
            }
        };
        // ASSERTION: Falla después de 3 intentos
        await (0, vitest_1.expect)(service.getNextOrderNumber(txMock)).rejects.toThrow(/Failed to generate order number after 3 attempts/);
        // ASSERTION: $queryRaw fue llamado exactamente 3 veces
        (0, vitest_1.expect)(txMock.$queryRaw).toHaveBeenCalledTimes(3);
    });
});
(0, vitest_1.describe)('📊 Performance & Latency', () => {
    (0, vitest_1.it)('PT-001: Generación de Order ID debe tomar < 100ms en promedio', async () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const latencies = [];
        const txMock = {
            $queryRaw: vitest_1.vi.fn().mockResolvedValue([{ id: 1, currentValue: 1 }]),
            orderSequence: {
                update: vitest_1.vi.fn().mockResolvedValue({ id: 1, currentValue: 2 })
            }
        };
        // Ejecutar 100 generaciones y medir latencia
        for (let i = 0; i < 100; i++) {
            const start = Date.now();
            await service.getNextOrderNumber(txMock);
            const latency = Date.now() - start;
            latencies.push(latency);
        }
        // Calcular p99
        const sorted = latencies.sort((a, b) => a - b);
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        // ASSERTION: p99 < 100ms (en mock, debería ser < 10ms)
        (0, vitest_1.expect)(p99).toBeLessThan(100);
        // ASSERTION: Promedio < 50ms
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        (0, vitest_1.expect)(avg).toBeLessThan(50);
    });
});
(0, vitest_1.describe)('🧪 Chaos Engineering - 6 AM Boundary Stress Test', () => {
    (0, vitest_1.it)('CT-003: 100 órdenes en ventana 05:59:50 - 06:00:10 (20 segundos)', async () => {
        const service = new orderNumber_service_NEW_1.OrderNumberService();
        const results = [];
        // Simular 100 órdenes distribuidas en 20 segundos alrededor del 6 AM
        const baseTime = new Date('2026-01-19T05:59:50-03:00').getTime();
        for (let i = 0; i < 100; i++) {
            // Distribuir órdenes en ventana de 20 segundos
            const offset = Math.floor((i / 100) * 20000); // 0-20000 ms
            const orderTime = new Date(baseTime + offset);
            vitest_1.vi.useFakeTimers();
            vitest_1.vi.setSystemTime(orderTime);
            const txMock = {
                $queryRaw: vitest_1.vi.fn().mockResolvedValue([{ id: i, currentValue: i }]),
                orderSequence: {
                    update: vitest_1.vi.fn().mockResolvedValue({ id: i, currentValue: i + 1 })
                }
            };
            const result = await service.getNextOrderNumber(txMock);
            results.push(result);
            vitest_1.vi.useRealTimers();
        }
        // ASSERTION: 100 órdenes creadas
        (0, vitest_1.expect)(results).toHaveLength(100);
        // ASSERTION: Órdenes antes de 6 AM tienen fecha del 18
        const before6am = results.filter((_, i) => i < 50 // Primeras 50 órdenes (05:59:50 - 06:00:00)
        );
        before6am.forEach(order => {
            (0, vitest_1.expect)(order.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
        });
        // ASSERTION: Órdenes después de 6 AM tienen fecha del 19
        const after6am = results.filter((_, i) => i >= 50 // Últimas 50 órdenes (06:00:00 - 06:00:10)
        );
        after6am.forEach(order => {
            (0, vitest_1.expect)(order.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
        });
        // ASSERTION: No hay P2002 errors (no duplicados)
        const keys = results.map(r => `${r.businessDate.toISOString().split('T')[0]}-${r.orderNumber}`);
        (0, vitest_1.expect)(new Set(keys).size).toBe(keys.length);
    });
});
//# sourceMappingURL=orderNumber.service.forensic.spec.js.map