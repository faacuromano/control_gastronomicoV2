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
      create: jest.fn(),
      update: jest.fn()
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
    register: jest.fn().mockResolvedValue({ movement: {}, newStock: 10 }),
    registerBatch: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock KDSService
jest.mock('../../src/services/kds.service', () => ({
  kdsService: {
    broadcastNewOrder: jest.fn(),
    broadcastOrderUpdate: jest.fn(),
    broadcastNewOrderWithStations: jest.fn(),
    calculatePrepTime: jest.fn().mockReturnValue(10)
  }
}));

// Mock AuditService (used by addPayments)
jest.mock('../../src/services/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logAuth: jest.fn().mockResolvedValue(undefined),
    logOrder: jest.fn().mockResolvedValue(undefined),
    logPayment: jest.fn().mockResolvedValue(undefined),
    logCashShift: jest.fn().mockResolvedValue(undefined),
  }
}));

// Mock logger (suppress console output in tests)
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock LoyaltyService
jest.mock('../../src/services/loyalty.service', () => ({
  LoyaltyService: jest.fn().mockImplementation(() => ({
    awardPoints: jest.fn().mockResolvedValue(0)
  }))
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

  // ========================================================================
  // getById
  // ========================================================================

  describe('getById', () => {
    it('should return order with all includes when found', async () => {
      const mockOrder = {
        id: 1,
        tenantId: 1,
        orderNumber: 1001,
        total: '150.00',
        items: [],
        payments: [],
        client: null,
        driver: null,
      };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const result = await orderService.getById(1, 1);

      expect(result).toEqual(mockOrder);
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 1, tenantId: 1 },
        include: expect.objectContaining({
          payments: true,
          client: true,
          driver: true,
        }),
      });
    });

    it('should return null when order not found', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await orderService.getById(999, 1);

      expect(result).toBeNull();
    });

    it('should scope query by tenantId for isolation', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderService.getById(1, 42);

      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, tenantId: 42 },
        })
      );
    });
  });

  // ========================================================================
  // addPayments
  // ========================================================================

  describe('addPayments', () => {
    /**
     * Helper to create a transaction mock for addPayments tests.
     * The tx object mimics the Prisma transaction client with all needed models.
     */
    const createAddPaymentsTxMock = (orderOverrides: Record<string, unknown> = {}) => {
      const mockOrder = {
        id: 1,
        tenantId: 1,
        orderNumber: 1001,
        status: 'OPEN',
        paymentStatus: 'PENDING',
        total: '100.00',
        payments: [],
        table: null,
        tableId: null,
        ...orderOverrides,
      };

      return {
        $queryRaw: jest.fn().mockResolvedValue([]),
        order: {
          findFirst: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue(mockOrder),
        },
        payment: {
          create: jest.fn().mockResolvedValue({ id: 1, amount: 100, method: 'CASH' }),
        },
        cashShift: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 }),
        },
        table: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
    };

    it('should add full payment and mark order as paid when closeOrder is true', async () => {
      const txMock = createAddPaymentsTxMock();
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null); // getById after tx

      const result = await orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 100 }], closeOrder: true },
        1, 1, 1
      );

      expect(result.paymentStatus).toBe('PAID');
      expect(result.orderClosed).toBe(true);
      expect(result.amountAdded).toBe(100);
      expect(result.totalPaid).toBe(100);
      expect(result.remainingBalance).toBe(0);
      expect(txMock.payment.create).toHaveBeenCalled();
      expect(txMock.order.update).toHaveBeenCalled();
    });

    it('should handle partial payment correctly', async () => {
      const txMock = createAddPaymentsTxMock();
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 40 }] },
        1, 1, 1
      );

      expect(result.paymentStatus).toBe('PARTIAL');
      expect(result.amountAdded).toBe(40);
      expect(result.remainingBalance).toBe(60);
      expect(result.orderClosed).toBe(false);
    });

    it('should accumulate payments with existing partial payments', async () => {
      const txMock = createAddPaymentsTxMock({
        payments: [{ id: 1, amount: '30.00', method: 'CASH' }], // 30 already paid
      });
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 70 }], closeOrder: true },
        1, 1, 1
      );

      expect(result.previouslyPaid).toBe(30);
      expect(result.amountAdded).toBe(70);
      expect(result.totalPaid).toBe(100);
      expect(result.paymentStatus).toBe('PAID');
    });

    it('should release table when closing order with table', async () => {
      const txMock = createAddPaymentsTxMock({
        tableId: 5,
        table: { id: 5, status: 'OCCUPIED' },
      });
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 100 }], closeOrder: true },
        1, 1, 1
      );

      expect(txMock.table.updateMany).toHaveBeenCalledWith({
        where: { id: 5, tenantId: 1 },
        data: { status: 'FREE', currentOrderId: null },
      });
    });

    it('should throw ValidationError for empty payments array', async () => {
      await expect(orderService.addPayments(
        1,
        { payments: [] },
        1, 1
      )).rejects.toThrow('At least one payment is required');
    });

    it('should throw ValidationError for negative payment amount', async () => {
      await expect(orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: -10 }] },
        1, 1
      )).rejects.toThrow('Payment amount must be positive');
    });

    it('should throw ValidationError for zero payment amount', async () => {
      await expect(orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 0 }] },
        1, 1
      )).rejects.toThrow('Payment amount must be positive');
    });

    it('should throw NotFoundError when order does not exist', async () => {
      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        order: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addPayments(
        999,
        { payments: [{ method: 'CASH', amount: 50 }] },
        1, 1, 1
      )).rejects.toThrow('Order');
    });

    it('should throw ConflictError when order is cancelled', async () => {
      const txMock = createAddPaymentsTxMock({ status: 'CANCELLED' });
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 50 }] },
        1, 1, 1
      )).rejects.toThrow('cancelled');
    });

    it('should throw ConflictError when order is already fully paid', async () => {
      const txMock = createAddPaymentsTxMock({ paymentStatus: 'PAID' });
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 50 }] },
        1, 1, 1
      )).rejects.toThrow('already fully paid');
    });

    it('should throw ValidationError for overpayment exceeding 10% tolerance', async () => {
      const txMock = createAddPaymentsTxMock(); // total 100
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addPayments(
        1,
        { payments: [{ method: 'CASH', amount: 200 }] }, // 200 > 110 (10% tolerance)
        1, 1, 1
      )).rejects.toThrow('exceeds order total');
    });

    it('should throw ValidationError for invalid orderId', async () => {
      await expect(orderService.addPayments(
        0,
        { payments: [{ method: 'CASH', amount: 50 }] },
        1, 1
      )).rejects.toThrow('Order ID must be a positive integer');
    });
  });

  // ========================================================================
  // addItemsToOrder
  // ========================================================================

  describe('addItemsToOrder', () => {
    it('should add items and recalculate order total', async () => {
      const existingOrder = {
        id: 1,
        tenantId: 1,
        orderNumber: 1001,
        status: 'OPEN',
        paymentStatus: 'PENDING',
        subtotal: '100.00',
        total: '100.00',
        items: [{ id: 1, productId: 1, quantity: 1, unitPrice: '100.00' }],
      };

      const newProduct = {
        id: 2,
        name: 'New Product',
        price: '50.00',
        isActive: true,
        isStockable: false,
        ingredients: [],
      };

      const updatedOrder = {
        ...existingOrder,
        subtotal: 200,
        total: 200,
        items: [
          ...existingOrder.items,
          { id: 2, productId: 2, quantity: 2, unitPrice: '50.00', product: newProduct },
        ],
      };

      const txMock = {
        order: {
          findFirst: jest.fn().mockResolvedValue(existingOrder),
          update: jest.fn().mockResolvedValue(updatedOrder),
        },
        product: {
          findMany: jest.fn().mockResolvedValue([newProduct]),
        },
        modifierOption: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        orderItem: {
          create: jest.fn().mockResolvedValue({ id: 2 }),
        },
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null); // getByIdForKds after tx

      const result = await orderService.addItemsToOrder(
        1,
        [{ productId: 2, quantity: 2 }],
        1, // serverId
        1  // tenantId
      );

      // Verify totals: existing 100 + new (50 * 2) = 200
      expect(txMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            subtotal: 200,
            total: 200,
          }),
        })
      );
      expect(txMock.orderItem.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError when order does not exist', async () => {
      const txMock = {
        order: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addItemsToOrder(
        999, [{ productId: 1, quantity: 1 }], 1, 1
      )).rejects.toThrow('Order');
    });

    it('should throw ValidationError when order is already paid', async () => {
      const paidOrder = {
        id: 1,
        tenantId: 1,
        paymentStatus: 'PAID',
        items: [],
      };

      const txMock = {
        order: { findFirst: jest.fn().mockResolvedValue(paidOrder) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));

      await expect(orderService.addItemsToOrder(
        1, [{ productId: 1, quantity: 1 }], 1, 1
      )).rejects.toThrow('Cannot modify paid order');
    });

    it('should reopen DELIVERED order when adding new items', async () => {
      const deliveredOrder = {
        id: 1,
        tenantId: 1,
        orderNumber: 1001,
        status: 'DELIVERED',
        paymentStatus: 'PENDING',
        subtotal: '100.00',
        total: '100.00',
        items: [],
      };

      const txMock = {
        order: {
          findFirst: jest.fn().mockResolvedValue(deliveredOrder),
          update: jest.fn().mockResolvedValue({ ...deliveredOrder, status: 'OPEN' }),
        },
        product: {
          findMany: jest.fn().mockResolvedValue([{
            id: 1, name: 'P1', price: '50.00', isActive: true, isStockable: false, ingredients: [],
          }]),
        },
        modifierOption: { findMany: jest.fn().mockResolvedValue([]) },
        orderItem: { create: jest.fn().mockResolvedValue({ id: 2 }) },
      };

      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderService.addItemsToOrder(1, [{ productId: 1, quantity: 1 }], 1, 1);

      expect(txMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OPEN',
          }),
        })
      );
    });
  });

  // ========================================================================
  // createOrder — Stock deduction & order number integration
  // ========================================================================

  describe('createOrder - integration checks', () => {
    it('should call isFeatureEnabled to check stock flag', async () => {
      const { isFeatureEnabled } = require('../../src/services/featureFlags.service');

      const txMock = {
        product: { findMany: jest.fn().mockResolvedValue([mockProduct]) },
        modifierOption: { findMany: jest.fn().mockResolvedValue([]) },
        order: { create: jest.fn().mockResolvedValue({ id: 1, orderNumber: 1001, status: 'OPEN', items: [] }) },
        cashShift: { findFirst: jest.fn().mockResolvedValue(mockShift) },
        user: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
        ingredient: { update: jest.fn() },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null); // getByIdForKds

      await orderService.createOrder({
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        serverId: 1,
      });

      expect(isFeatureEnabled).toHaveBeenCalledWith('enableStock', 1);
    });

    it('should call orderNumberService.getNextOrderNumber with tenant and businessDate', async () => {
      const { orderNumberService } = require('../../src/services/orderNumber.service');

      const txMock = {
        product: { findMany: jest.fn().mockResolvedValue([mockProduct]) },
        modifierOption: { findMany: jest.fn().mockResolvedValue([]) },
        order: { create: jest.fn().mockResolvedValue({ id: 1, orderNumber: 1001, status: 'OPEN', items: [] }) },
        cashShift: { findFirst: jest.fn().mockResolvedValue(mockShift) },
        user: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
        ingredient: { update: jest.fn() },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderService.createOrder({
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        serverId: 1,
      });

      expect(orderNumberService.getNextOrderNumber).toHaveBeenCalledWith(
        expect.anything(), // tx client
        1,                 // tenantId
        expect.any(Date)   // businessDate
      );
    });

    it('should call executeIfEnabled for stock processing after order creation', async () => {
      const { executeIfEnabled } = require('../../src/services/featureFlags.service');

      const txMock = {
        product: { findMany: jest.fn().mockResolvedValue([mockProduct]) },
        modifierOption: { findMany: jest.fn().mockResolvedValue([]) },
        order: { create: jest.fn().mockResolvedValue({ id: 1, orderNumber: 1001, status: 'OPEN', items: [] }) },
        cashShift: { findFirst: jest.fn().mockResolvedValue(mockShift) },
        user: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
        ingredient: { update: jest.fn() },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation(async (fn) => fn(txMock));
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderService.createOrder({
        tenantId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        serverId: 1,
      });

      // processStockUpdates calls executeIfEnabled('enableStock', callback, tenantId)
      expect(executeIfEnabled).toHaveBeenCalledWith(
        'enableStock',
        expect.any(Function),
        1
      );
    });
  });
});
