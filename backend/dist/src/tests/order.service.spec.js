"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const order_service_1 = require("../services/order.service");
const stockMovement_service_1 = require("../services/stockMovement.service");
const FeatureFlags = __importStar(require("../services/featureFlags.service"));
// Mock dependencies
jest.mock('../services/stockMovement.service');
jest.mock('../services/featureFlags.service');
const mockTx = {}; // Mock Transaction Client
describe('OrderService - Feature Flags Integrity', () => {
    let orderService;
    let mockStockService;
    beforeEach(() => {
        orderService = new order_service_1.OrderService();
        mockStockService = new stockMovement_service_1.StockMovementService();
        // Inject mock stock service if possible, or we rely on the module mock
        stockMovement_service_1.StockMovementService.mockImplementation(() => mockStockService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    test('Should NOT deduct stock when enableStock flag is FALSE', async () => {
        // Arrange
        const stockUpdates = [{ ingredientId: 1, quantity: 10 }];
        // Mock Feature Flag to be DISABLED
        FeatureFlags.executeIfEnabled.mockImplementation(async (flag, fn) => {
            if (flag === 'enableStock')
                return undefined; // Simulate disabled behavior
            return fn();
        });
        // Act
        // Accessing private method for testing purpose via prototype or casting
        await orderService.processStockUpdates(mockTx, stockUpdates);
        // Assert
        // The stock service register method should NEVER be called
        expect(mockStockService.register).not.toHaveBeenCalled();
    });
    test('Should deduct stock when enableStock flag is TRUE', async () => {
        // Arrange
        const stockUpdates = [{ ingredientId: 1, quantity: 10 }];
        // Mock Feature Flag to be ENABLED
        FeatureFlags.executeIfEnabled.mockImplementation(async (flag, fn) => {
            return fn(); // Execute the callback
        });
        // Act
        await orderService.processStockUpdates(mockTx, stockUpdates);
        // Assert
        expect(mockStockService.register).toHaveBeenCalledWith(1, 'SALE', 10, mockTx);
    });
});
//# sourceMappingURL=order.service.spec.js.map