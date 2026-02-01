/**
 * Order Service Unit Tests
 */

import { StockMoveType, OrderChannel, PaymentMethod } from '@prisma/client';

// Mock Prisma
const mockTransaction = jest.fn();
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: (fn: any) => mockTransaction(fn),
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    product: {
      findUnique: jest.fn()
    },
    cashShift: {
      findFirst: jest.fn()
    }
  }
}));

// Mock FeatureFlags service
jest.mock('../../src/services/featureFlags.service', () => ({
  executeIfEnabled: jest.fn().mockResolvedValue(undefined),
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
  clearConfigCache: jest.fn()
}));

// Mock StockMovementService
jest.mock('../../src/services/stockMovement.service', () => ({
  StockMovementService: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ movement: {}, newStock: 10 })
  }))
}));

// Mock KDSService
jest.mock('../../src/services/kds.service', () => ({
  kdsService: {
    broadcastNewOrder: jest.fn(),
    broadcastOrderUpdate: jest.fn(),
    calculatePrepTime: jest.fn().mockReturnValue(10)
  }
}));

// Mock businessDate service
jest.mock('../../src/services/businessDate.service', () => ({
  businessDateService: {
    determineBusinessDate: jest.fn().mockResolvedValue(new Date('2026-01-19'))
  }
}));

// Mock orderNumber service
jest.mock('../../src/services/orderNumber.service', () => ({
  orderNumberService: {
    getNextOrderNumber: jest.fn().mockResolvedValue({
      id: 'test-uuid',
      orderNumber: 1001,
      formattedOrderNumber: '20260119-1001',
      businessDate: new Date('2026-01-19')
    })
  },
  OrderNumberService: jest.fn()
}));

import { prisma } from '../../src/lib/prisma';
import { OrderService, OrderItemInput, CreateOrderInput } from '../../src/services/order.service';

describe('OrderService', () => {
  let orderService: OrderService;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: '100.00',
    isActive: true,
    isStockable: true,
    ingredients: [
      {
        ingredientId: 1,
        quantity: '2.00',
        ingredient: {
          id: 1,
          name: 'Test Ingredient',
          stock: '100.00'
        }
      }
    ]
  };

  const mockShift = {
    id: 1,
    userId: 1,
    startTime: new Date(),
    endTime: null,
    startAmount: '1000.00'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    orderService = new OrderService();
  });

  describe('createOrder', () => {
    it('should create an order successfully with valid data', async () => {
      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue([mockProduct])
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        order: {
          create: jest.fn().mockResolvedValue({
            id: 1,
            orderNumber: 1001,
            total: '200.00',
            items: []
          })
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(mockShift)
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 })
        },
        ingredient: {
          update: jest.fn()
        },
        stockMovement: {
          create: jest.fn()
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 2 }],
        channel: 'POS',
        serverId: 1,
        paymentMethod: 'CASH'
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('orderNumber', 1001);
      expect(txMock.order.create).toHaveBeenCalled();
      expect(txMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [1] }, tenantId: 1 }
        })
      );
    });

    it('should throw error when product not found', async () => {
      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue([])  // Empty array = product not found
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(mockShift)
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [{ productId: 999, quantity: 1 }],
        serverId: 1
      };

      await expect(orderService.createOrder(orderData))
        .rejects.toThrow('Product ID 999 not found');
    });

    it('should throw error when product is inactive', async () => {
      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue([{
            ...mockProduct,
            isActive: false
          }])
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(mockShift)
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        serverId: 1
      };

      await expect(orderService.createOrder(orderData))
        .rejects.toThrow('is not active');
    });

    it('should create order successfully even without server ID', async () => {
      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue([mockProduct])
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        order: {
          create: jest.fn().mockResolvedValue({
            id: 1,
            orderNumber: 1001,
            total: '100.00',
            items: []
          })
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(null)  // No shift, but that's OK
        },
        ingredient: {
          update: jest.fn()
        },
        stockMovement: {
          create: jest.fn()
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }]
        // Missing serverId - should still work
      };

      const result = await orderService.createOrder(orderData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('orderNumber', 1001);
      expect(txMock.order.create).toHaveBeenCalled();
    });

    it('should allow order creation without open shift (logs warning)', async () => {
      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue([mockProduct])
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        order: {
          create: jest.fn().mockResolvedValue({
            id: 1,
            orderNumber: 1001,
            total: '100.00',
            items: []
          })
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(null) // No open shift
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 })
        },
        ingredient: {
          update: jest.fn()
        },
        stockMovement: {
          create: jest.fn()
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        serverId: 1
      };

      // Should NOT throw - service allows orders without shift
      const result = await orderService.createOrder(orderData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('orderNumber', 1001);
      expect(txMock.order.create).toHaveBeenCalled();
    });

    it('should calculate totals correctly for multiple items', async () => {
      const products = [
        { ...mockProduct, id: 1, price: '50.00' },
        { ...mockProduct, id: 2, price: '75.00' }
      ];

      const txMock = {
        product: {
          findMany: jest.fn().mockResolvedValue(products)
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([])
        },
        order: {
          create: jest.fn().mockImplementation((args) => ({
            id: 1,
            orderNumber: 1001,
            subtotal: args.data.subtotal,
            total: args.data.total,
            items: []
          }))
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(mockShift)
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 })
        },
        ingredient: {
          update: jest.fn()
        },
        stockMovement: {
          create: jest.fn()
        }
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      const orderData: CreateOrderInput = {
        tenantId: 1,
        userId: 1,
        items: [
          { productId: 1, quantity: 2 }, // 2 x 50 = 100
          { productId: 2, quantity: 3 }  // 3 x 75 = 225
        ],
        serverId: 1
      };

      const result = await orderService.createOrder(orderData);

      // Expected total: 100 + 225 = 325
      expect(result.subtotal).toBe(325);
      expect(result.total).toBe(325);
      expect(txMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [1, 2] }, tenantId: 1 }
        })
      );
    });
  });

  describe('getRecentOrders', () => {
    it('should return list of recent orders', async () => {
      const mockOrders = [
        { id: 1, orderNumber: 1001, total: '100.00', items: [] },
        { id: 2, orderNumber: 1002, total: '200.00', items: [] }
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await orderService.getRecentOrders(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('orderNumber', 1001);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          orderBy: { createdAt: 'desc' }
        })
      );
    });
  });
});
