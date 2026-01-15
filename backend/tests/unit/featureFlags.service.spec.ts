/**
 * @fileoverview Unit Tests for Feature Flags Service
 * 
 * Tests the executeIfEnabled pattern that allows optional modules
 * to fail gracefully without affecting core functionality.
 */

import { executeIfEnabled, clearConfigCache } from '../../src/services/featureFlags.service';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        tenantConfig: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
        }
    }
}));

import { prisma } from '../../src/lib/prisma';

describe('Feature Flags Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearConfigCache(); // Clear cache between tests
    });

    describe('executeIfEnabled', () => {
        /**
         * @test
         * Verifies that stock is NOT deducted when enableStock flag is false.
         * 
         * @business_rule
         * When a tenant has Stock module disabled (enableStock: false),
         * any stock-related operations should be skipped silently.
         * This allows the POS to function without inventory management.
         */
        it('should NOT execute function when flag is disabled', async () => {
            // Arrange: Mock config with stock DISABLED
            const mockConfig = {
                id: 1,
                businessName: 'Test Business',
                enableStock: false,
                enableDelivery: true,
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            };
            (prisma.tenantConfig.findFirst as jest.Mock).mockResolvedValue(mockConfig);

            // Mock function that should NOT be called
            const stockDeductionFn = jest.fn().mockResolvedValue({ success: true });

            // Act: Try to execute with disabled flag
            const result = await executeIfEnabled('enableStock', stockDeductionFn, undefined);

            // Assert: Function was NOT called, returned undefined (fallback)
            expect(stockDeductionFn).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        /**
         * @test
         * Verifies that stock IS deducted when enableStock flag is true.
         */
        it('should execute function when flag is enabled', async () => {
            // Arrange: Mock config with stock ENABLED
            const mockConfig = {
                id: 1,
                businessName: 'Test Business',
                enableStock: true,
                enableDelivery: true,
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            };
            (prisma.tenantConfig.findFirst as jest.Mock).mockResolvedValue(mockConfig);

            // Mock function that SHOULD be called
            const stockDeductionFn = jest.fn().mockResolvedValue({ deducted: 10 });

            // Act
            const result = await executeIfEnabled('enableStock', stockDeductionFn);

            // Assert: Function WAS called
            expect(stockDeductionFn).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ deducted: 10 });
        });

        /**
         * @test
         * Verifies graceful degradation when optional module throws an error.
         * 
         * @business_rule
         * Optional modules should fail gracefully. If stock service crashes,
         * the order should still be created - inventory is secondary.
         */
        it('should return fallback when function throws and flag is enabled', async () => {
            // Arrange
            const mockConfig = {
                id: 1,
                businessName: 'Test Business',
                enableStock: true,
                enableDelivery: false,
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            };
            (prisma.tenantConfig.findFirst as jest.Mock).mockResolvedValue(mockConfig);

            // Mock function that THROWS an error
            const failingFn = jest.fn().mockRejectedValue(new Error('Database connection failed'));

            // Act: Execute with error - should not throw, should return fallback
            const result = await executeIfEnabled('enableStock', failingFn, { fallbackUsed: true });

            // Assert: Error was caught, fallback returned
            expect(failingFn).toHaveBeenCalled();
            expect(result).toEqual({ fallbackUsed: true });
        });

        /**
         * @test
         * Verifies Delivery module respects its own flag independently.
         */
        it('should respect enableDelivery flag independently', async () => {
            // Arrange: Delivery enabled, Stock disabled
            const mockConfig = {
                id: 1,
                businessName: 'Test Business',
                enableStock: false,
                enableDelivery: true,
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            };
            (prisma.tenantConfig.findFirst as jest.Mock).mockResolvedValue(mockConfig);

            const deliveryFn = jest.fn().mockResolvedValue({ tracking: 'ABC123' });
            const stockFn = jest.fn().mockResolvedValue({ deducted: 5 });

            // Act
            const deliveryResult = await executeIfEnabled('enableDelivery', deliveryFn);
            
            // Clear cache to refetch
            clearConfigCache();
            (prisma.tenantConfig.findFirst as jest.Mock).mockResolvedValue(mockConfig);
            
            const stockResult = await executeIfEnabled('enableStock', stockFn);

            // Assert
            expect(deliveryFn).toHaveBeenCalled();
            expect(deliveryResult).toEqual({ tracking: 'ABC123' });
            
            expect(stockFn).not.toHaveBeenCalled();
            expect(stockResult).toBeUndefined();
        });
    });
});
