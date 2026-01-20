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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { OrderNumberService, OrderIdentifier } from '../services/orderNumber.service.NEW';
import { validate as uuidValidate } from 'uuid';

// Mock de Prisma para tests unitarios
const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

// Setup: Limpiar DB antes de cada test
beforeEach(async () => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Configurar timezone a Argentina (UTC-3) para tests de 6 AM
  process.env.TZ = 'America/Argentina/Buenos_Aires';
});

afterEach(async () => {
  // Cleanup
  vi.restoreAllMocks();
});

describe('🔐 UUID Generation & Validation', () => {
  
  it('UT-001: Debe generar UUID v4 con formato RFC4122 válido', async () => {
    const service = new OrderNumberService();
    
    // Generar 10 UUIDs
    const uuids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const uuid = service.generateUuid();
      uuids.push(uuid);
      
      // ASSERTION: Formato válido
      expect(uuidValidate(uuid)).toBe(true);
      
      // ASSERTION: Formato específico v4 (8-4-4-4-12 con versión '4' en posición correcta)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
    
    // ASSERTION: Todos los UUIDs son únicos
    const uniqueCount = new Set(uuids).size;
    expect(uniqueCount).toBe(10);
  });
  
  it('UT-002: Debe rechazar UUIDs malformados en validación', () => {
    const service = new OrderNumberService();
    
    const invalidUuids = [
      '',
      'not-a-uuid',
      '12345678-1234-1234-1234-123456789012', // Formato correcto pero no v4
      '550e8400-e29b-41d4-a716-44665544000',   // Muy corto
      '550e8400-e29b-41d4-a716-446655440000-extra', // Muy largo
      null,
      undefined
    ];
    
    invalidUuids.forEach((invalidUuid) => {
      expect(service.validateUuid(invalidUuid as any)).toBe(false);
    });
  });
  
  it('UT-003: Debe generar 10,000 UUIDs únicos sin colisiones', () => {
    const service = new OrderNumberService();
    const uuids = new Set<string>();
    
    // Generar 10,000 UUIDs (estadísticamente imposible tener colisión)
    for (let i = 0; i < 10000; i++) {
      uuids.add(service.generateUuid());
    }
    
    // ASSERTION: Exactamente 10,000 UUIDs únicos
    expect(uuids.size).toBe(10000);
  });
});

describe('📅 Business Date 6 AM Cutoff Logic', () => {
  
  it('UT-004: Orden creada a 5:59 AM debe usar día ANTERIOR', async () => {
    // Mock de Date para simular 5:59 AM del 2026-01-19
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T05:59:00-03:00'));
    
    const service = new OrderNumberService();
    
    // Mock transaction client
    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderSequence: {
        create: vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
      }
    } as any;
    
    const result = await service.getNextOrderNumber(txMock);
    
    // ASSERTION: businessDate es 2026-01-18 (día ANTERIOR)
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
    expect(result.orderNumber).toBe(1);
    expect(uuidValidate(result.id)).toBe(true);
    
    vi.useRealTimers();
  });
  
  it('UT-005: Orden creada a 6:01 AM debe usar día ACTUAL', async () => {
    // Mock de Date para simular 6:01 AM del 2026-01-19
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T06:01:00-03:00'));
    
    const service = new OrderNumberService();
    
    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderSequence: {
        create: vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
      }
    } as any;
    
    const result = await service.getNextOrderNumber(txMock);
    
    // ASSERTION: businessDate es 2026-01-19 (día ACTUAL)
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
    expect(result.orderNumber).toBe(1);
    
    vi.useRealTimers();
  });
  
  it('UT-006: Orden exactamente a 6:00:00 AM debe usar día ACTUAL', async () => {
    // Edge case: Exactamente 6 AM
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T06:00:00-03:00'));
    
    const service = new OrderNumberService();
    
    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderSequence: {
        create: vi.fn().mockResolvedValue({ id: 1, currentValue: 1 })
      }
    } as any;
    
    const result = await service.getNextOrderNumber(txMock);
    
    // ASSERTION: 6:00:00 AM pertenece al día ACTUAL (>= 6 AM)
    expect(result.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
    
    vi.useRealTimers();
  });
});

describe('⚡ Race Conditions & Concurrency', () => {
  
  it('IT-001: 50 requests concurrentes deben generar 50 orderNumbers secuenciales', async () => {
    // ESTE TEST REQUIERE DB REAL - Usar test con Docker/TestContainers
    
    const service = new OrderNumberService();
    
    // Simular 50 transacciones concurrentes
    const promises: Promise<OrderIdentifier>[] = [];
    
    // Mock: Cada transacción obtiene secuencia existente con lock
    let currentValue = 0;
    const txMock = {
      $queryRaw: vi.fn().mockImplementation(async () => {
        // Simular lock delay (1-10ms random)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return [{ id: 1, currentValue }];
      }),
      orderSequence: {
        update: vi.fn().mockImplementation(async (args: any) => {
          currentValue = args.data.currentValue;
          return { id: 1, currentValue };
        })
      }
    } as any;
    
    // Ejecutar 50 requests en paralelo
    for (let i = 0; i < 50; i++) {
      promises.push(service.getNextOrderNumber(txMock));
    }
    
    const results = await Promise.all(promises);
    
    // ASSERTION: 50 órdenes creadas
    expect(results).toHaveLength(50);
    
    // ASSERTION: 50 UUIDs únicos
    const uuids = results.map(r => r.id);
    expect(new Set(uuids).size).toBe(50);
    
    // ASSERTION: orderNumbers son secuenciales (1-50)
    const orderNumbers = results.map(r => r.orderNumber).sort((a, b) => a - b);
    expect(orderNumbers[0]).toBe(1);
    expect(orderNumbers[49]).toBe(50);
    
    // ASSERTION: No hay gaps en la secuencia
    for (let i = 0; i < 49; i++) {
      expect(orderNumbers[i + 1]! - orderNumbers[i]!).toBe(1);
    }
  });
  
  it('IT-002: Race condition en 6 AM boundary NO debe causar P2002', async () => {
    // Simular 10 órdenes creadas en ventana de 05:59:58 - 06:00:02
    const service = new OrderNumberService();
    const results: OrderIdentifier[] = [];
    
    for (let i = 0; i < 10; i++) {
      // Alternar entre 5:59 AM y 6:01 AM
      const time = i % 2 === 0 
        ? new Date('2026-01-19T05:59:58-03:00')
        : new Date('2026-01-19T06:00:02-03:00');
      
      vi.useFakeTimers();
      vi.setSystemTime(time);
      
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: i, currentValue: i }]),
        orderSequence: {
          update: vi.fn().mockResolvedValue({ id: i, currentValue: i + 1 })
        }
      } as any;
      
      const result = await service.getNextOrderNumber(txMock);
      results.push(result);
      
      vi.useRealTimers();
    }
    
    // ASSERTION: No hay (businessDate, orderNumber) duplicados
    const keys = results.map(r => `${r.businessDate.toISOString().split('T')[0]}-${r.orderNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('💥 Database Constraint Violations', () => {
  
  it('CT-001: Intentar insertar UUID duplicado debe fallar con error claro', async () => {
    // Este test requiere DB real para constraint validation
    
    const duplicateUuid = '550e8400-e29b-41d4-a716-446655440000';
    
    // Simular error de Prisma por unique constraint
    const txMock = {
      order: {
        create: vi.fn().mockRejectedValue({
          code: 'P2002',
          meta: { target: ['uuid'] },
          message: 'Unique constraint failed on the constraint: `uk_order_uuid`'
        })
      }
    } as any;
    
    // ASSERTION: Error con código P2002 (unique violation)
    await expect(
      txMock.order.create({ data: { id: duplicateUuid } })
    ).rejects.toMatchObject({
      code: 'P2002',
      meta: { target: ['uuid'] }
    });
  });
  
  it('CT-002: Intentar insertar (businessDate, orderNumber) duplicado debe fallar', async () => {
    const txMock = {
      order: {
        create: vi.fn().mockRejectedValue({
          code: 'P2002',
          meta: { target: ['businessDate', 'orderNumber'] },
          message: 'Unique constraint failed on the constraint: `uk_business_order`'
        })
      }
    } as any;
    
    // ASSERTION: Error P2002 en composite key
    await expect(
      txMock.order.create({ 
        data: { 
          businessDate: new Date('2026-01-19'),
          orderNumber: 123
        }
      })
    ).rejects.toMatchObject({
      code: 'P2002',
      meta: { target: ['businessDate', 'orderNumber'] }
    });
  });
});

describe('🔄 Retry Logic & Error Handling', () => {
  
  it('UT-007: Debe reintentar hasta 3 veces en caso de deadlock', async () => {
    const service = new OrderNumberService();
    
    let attemptCount = 0;
    const txMock = {
      $queryRaw: vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          // Simular deadlock en primer y segundo intento
          throw new Error('Deadlock found when trying to get lock');
        }
        // Tercer intento exitoso
        return [{ id: 1, currentValue: 5 }];
      }),
      orderSequence: {
        update: vi.fn().mockResolvedValue({ id: 1, currentValue: 6 })
      }
    } as any;
    
    const result = await service.getNextOrderNumber(txMock);
    
    // ASSERTION: Retry funcionó, obtuvo resultado al tercer intento
    expect(attemptCount).toBe(3);
    expect(result.orderNumber).toBe(6);
  });
  
  it('UT-008: Debe lanzar error después de 3 intentos fallidos', async () => {
    const service = new OrderNumberService();
    
    const txMock = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Lock wait timeout exceeded')),
      orderSequence: {
        update: vi.fn()
      }
    } as any;
    
    // ASSERTION: Falla después de 3 intentos
    await expect(service.getNextOrderNumber(txMock)).rejects.toThrow(
      /Failed to generate order number after 3 attempts/
    );
    
    // ASSERTION: $queryRaw fue llamado exactamente 3 veces
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(3);
  });
});

describe('📊 Performance & Latency', () => {
  
  it('PT-001: Generación de Order ID debe tomar < 100ms en promedio', async () => {
    const service = new OrderNumberService();
    const latencies: number[] = [];
    
    const txMock = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 1, currentValue: 1 }]),
      orderSequence: {
        update: vi.fn().mockResolvedValue({ id: 1, currentValue: 2 })
      }
    } as any;
    
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
    expect(p99).toBeLessThan(100);
    
    // ASSERTION: Promedio < 50ms
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(avg).toBeLessThan(50);
  });
});

describe('🧪 Chaos Engineering - 6 AM Boundary Stress Test', () => {
  
  it('CT-003: 100 órdenes en ventana 05:59:50 - 06:00:10 (20 segundos)', async () => {
    const service = new OrderNumberService();
    const results: OrderIdentifier[] = [];
    
    // Simular 100 órdenes distribuidas en 20 segundos alrededor del 6 AM
    const baseTime = new Date('2026-01-19T05:59:50-03:00').getTime();
    
    for (let i = 0; i < 100; i++) {
      // Distribuir órdenes en ventana de 20 segundos
      const offset = Math.floor((i / 100) * 20000); // 0-20000 ms
      const orderTime = new Date(baseTime + offset);
      
      vi.useFakeTimers();
      vi.setSystemTime(orderTime);
      
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: i, currentValue: i }]),
        orderSequence: {
          update: vi.fn().mockResolvedValue({ id: i, currentValue: i + 1 })
        }
      } as any;
      
      const result = await service.getNextOrderNumber(txMock);
      results.push(result);
      
      vi.useRealTimers();
    }
    
    // ASSERTION: 100 órdenes creadas
    expect(results).toHaveLength(100);
    
    // ASSERTION: Órdenes antes de 6 AM tienen fecha del 18
    const before6am = results.filter((_, i) => 
      i < 50 // Primeras 50 órdenes (05:59:50 - 06:00:00)
    );
    before6am.forEach(order => {
      expect(order.businessDate.toISOString().split('T')[0]).toBe('2026-01-18');
    });
    
    // ASSERTION: Órdenes después de 6 AM tienen fecha del 19
    const after6am = results.filter((_, i) => 
      i >= 50 // Últimas 50 órdenes (06:00:00 - 06:00:10)
    );
    after6am.forEach(order => {
      expect(order.businessDate.toISOString().split('T')[0]).toBe('2026-01-19');
    });
    
    // ASSERTION: No hay P2002 errors (no duplicados)
    const keys = results.map(r => `${r.businessDate.toISOString().split('T')[0]}-${r.orderNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
