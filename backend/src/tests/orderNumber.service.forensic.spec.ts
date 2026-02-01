
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { OrderNumberService, OrderIdentifier } from '../services/orderNumber.service';
import { validate as uuidValidate } from 'uuid';

// Mock de Prisma para tests unitarios
const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

describe('🔐 Order Sequence Generation (Multi-Tenant)', () => {
    
    it('UT-001: Respects passed Business Date and Tenant ID', async () => {
        const service = new OrderNumberService();
        const tenantId = 1;
        // Use Noon UTC to ensure it falls on same day in Western Hemisphere (UTC-3)
        const businessDate = new Date('2026-01-19T12:00:00.000Z');
        
        // Mock DB Upsert
        const txMock = {
            orderSequence: {
                upsert: vi.fn().mockResolvedValue({ 
                    id: 1, 
                    tenantId: 1, 
                    sequenceKey: 'TENANT_1_DATE_20260119', 
                    currentValue: 1 
                })
            }
        } as any;

        const result = await service.getNextOrderNumber(txMock, tenantId, businessDate);

        // ASSERTION: Returns correct formatted number
        expect(result.orderNumber).toBe(1);
        expect(result.formattedOrderNumber).toBe('20260119-0001');
        
        // ASSERTION: Props are correct
        expect(result.businessDate).toEqual(businessDate);
        expect(uuidValidate(result.id)).toBe(true);
    });

    it('UT-002: Formats Key correctly based on Date', async () => {
        const service = new OrderNumberService();
        const tenantId = 2;
        const businessDate = new Date('2026-10-25T12:00:00Z'); // Oct 25
        
        const txMock = {
            orderSequence: {
                upsert: vi.fn().mockImplementation((args) => {
                    // Check Key format in arguments
                    expect(args.where.tenantId_sequenceKey.sequenceKey).toBe('TENANT_2_DATE_20261025');
                    return { currentValue: 99 };
                })
            }
        } as any;

        const result = await service.getNextOrderNumber(txMock, tenantId, businessDate);
        expect(result.orderNumber).toBe(99);
        expect(result.formattedOrderNumber).toBe('20261025-0099');
    });

    it('UT-003: Retry Logic on Deadlock', async () => {
        const service = new OrderNumberService();
        const tenantId = 1;
        const businessDate = new Date();
        
        let attempt = 0;
        const txMock = {
            orderSequence: {
                upsert: vi.fn().mockImplementation(async () => {
                    attempt++;
                    if (attempt < 3) {
                        throw new Error('Deadlock found when trying to get lock; try restarting transaction');
                    }
                    return { currentValue: 5 };
                })
            }
        } as any;

        const result = await service.getNextOrderNumber(txMock, tenantId, businessDate);
        
        // ASSERTION: Retried 3 times (1 initial + 2 retries)
        expect(attempt).toBe(3);
        expect(result.orderNumber).toBe(5);
    });

    it('UT-004: Fails after max retries', async () => {
        const service = new OrderNumberService();
        const txMock = {
            orderSequence: {
                upsert: vi.fn().mockRejectedValue(new Error('Persistent Deadlock'))
            }
        } as any;

        await expect(service.getNextOrderNumber(txMock, 1, new Date()))
            .rejects.toThrow(/Failed to generate order number/);
    });
});
