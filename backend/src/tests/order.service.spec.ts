
import { OrderService } from '../services/order.service';
import { StockMovementService } from '../services/stockMovement.service';
import * as FeatureFlags from '../services/featureFlags.service';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../services/stockMovement.service');
jest.mock('../services/featureFlags.service');

const mockTx = {} as any; // Mock Transaction Client

describe('OrderService - Feature Flags Integrity', () => {
    let orderService: OrderService;
    let mockStockService: jest.Mocked<StockMovementService>;

    beforeEach(() => {
        orderService = new OrderService();
        mockStockService = new StockMovementService() as any;
        // Inject mock stock service if possible, or we rely on the module mock
        (StockMovementService as any).mockImplementation(() => mockStockService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Should NOT deduct stock when enableStock flag is FALSE', async () => {
        // Arrange
        const stockUpdates = [{ ingredientId: 1, quantity: 10 }];
        
        // Mock Feature Flag to be DISABLED
        (FeatureFlags.executeIfEnabled as jest.Mock).mockImplementation(async (flag, fn) => {
            if (flag === 'enableStock') return undefined; // Simulate disabled behavior
            return fn();
        });

        // Act
        // Accessing private method for testing purpose via prototype or casting
        await (orderService as any).processStockUpdates(mockTx, stockUpdates);

        // Assert
        // The stock service register method should NEVER be called
        expect(mockStockService.register).not.toHaveBeenCalled();
    });

    test('Should deduct stock when enableStock flag is TRUE', async () => {
        // Arrange
        const stockUpdates = [{ ingredientId: 1, quantity: 10 }];
        
        // Mock Feature Flag to be ENABLED
        (FeatureFlags.executeIfEnabled as jest.Mock).mockImplementation(async (flag, fn) => {
           return fn(); // Execute the callback
        });

        // Act
        await (orderService as any).processStockUpdates(mockTx, stockUpdates);

        // Assert
        expect(mockStockService.register).toHaveBeenCalledWith(
            1, 
            'SALE', 
            10, 
            mockTx
        );
    });
});
