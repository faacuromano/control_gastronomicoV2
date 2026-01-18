"use strict";
/**
 * Order Service Unit Tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock Prisma
const mockTransaction = jest.fn();
jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        $transaction: (fn) => mockTransaction(fn),
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
const prisma_1 = require("../../src/lib/prisma");
const order_service_1 = require("../../src/services/order.service");
describe('OrderService', () => {
    let orderService;
    const mockProduct = {
        id: 1,
        name: 'Test Product',
        price: '100.00',
        isActive: true,
        isStockable: true,
        ingredients: [
            { ingredientId: 1, quantity: '2.00' }
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
        orderService = new order_service_1.OrderService();
    });
    describe('createOrder', () => {
        it('should create an order successfully with valid data', async () => {
            const txMock = {
                product: {
                    findUnique: jest.fn().mockResolvedValue(mockProduct)
                },
                order: {
                    findFirst: jest.fn().mockResolvedValue({ orderNumber: 1000 }),
                    create: jest.fn().mockResolvedValue({
                        id: 1,
                        orderNumber: 1001,
                        total: '100.00',
                        items: []
                    })
                },
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(mockShift)
                },
                ingredient: {
                    update: jest.fn()
                },
                stockMovement: {
                    create: jest.fn()
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
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
        });
        it('should throw error when product not found', async () => {
            const txMock = {
                product: {
                    findUnique: jest.fn().mockResolvedValue(null)
                },
                order: {
                    findFirst: jest.fn()
                },
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(mockShift)
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
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
                    findUnique: jest.fn().mockResolvedValue({
                        ...mockProduct,
                        isActive: false
                    })
                },
                order: {
                    findFirst: jest.fn()
                },
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(mockShift)
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
                userId: 1,
                items: [{ productId: 1, quantity: 1 }],
                serverId: 1
            };
            await expect(orderService.createOrder(orderData))
                .rejects.toThrow('is not active');
        });
        it('should throw error when no server ID provided', async () => {
            const txMock = {
                product: {
                    findUnique: jest.fn().mockResolvedValue(mockProduct)
                },
                order: {
                    findFirst: jest.fn()
                },
                cashShift: {
                    findFirst: jest.fn()
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
                userId: 1,
                items: [{ productId: 1, quantity: 1 }]
                // Missing serverId
            };
            await expect(orderService.createOrder(orderData))
                .rejects.toThrow('Server ID is required');
        });
        it('should throw error when no open shift exists', async () => {
            const txMock = {
                product: {
                    findUnique: jest.fn().mockResolvedValue(mockProduct)
                },
                order: {
                    findFirst: jest.fn()
                },
                cashShift: {
                    findFirst: jest.fn().mockResolvedValue(null) // No open shift
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
                userId: 1,
                items: [{ productId: 1, quantity: 1 }],
                serverId: 1
            };
            await expect(orderService.createOrder(orderData))
                .rejects.toThrow('NO_OPEN_SHIFT');
        });
        it('should calculate totals correctly for multiple items', async () => {
            const products = [
                { ...mockProduct, id: 1, price: '50.00' },
                { ...mockProduct, id: 2, price: '75.00' }
            ];
            const txMock = {
                product: {
                    findUnique: jest.fn()
                        .mockResolvedValueOnce(products[0])
                        .mockResolvedValueOnce(products[1])
                },
                order: {
                    findFirst: jest.fn().mockResolvedValue({ orderNumber: 1000 }),
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
                ingredient: {
                    update: jest.fn()
                },
                stockMovement: {
                    create: jest.fn()
                }
            };
            mockTransaction.mockImplementation(async (fn) => fn(txMock));
            const orderData = {
                userId: 1,
                items: [
                    { productId: 1, quantity: 2 }, // 2 x 50 = 100
                    { productId: 2, quantity: 3 } // 3 x 75 = 225
                ],
                serverId: 1
            };
            const result = await orderService.createOrder(orderData);
            // Expected total: 100 + 225 = 325
            expect(result.subtotal).toBe(325);
            expect(result.total).toBe(325);
        });
    });
    describe('getRecentOrders', () => {
        it('should return list of recent orders', async () => {
            const mockOrders = [
                { id: 1, orderNumber: 1001, total: '100.00', items: [] },
                { id: 2, orderNumber: 1002, total: '200.00', items: [] }
            ];
            prisma_1.prisma.order.findMany.mockResolvedValue(mockOrders);
            const result = await orderService.getRecentOrders();
            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('orderNumber', 1001);
            expect(prisma_1.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
                take: 50,
                orderBy: { createdAt: 'desc' }
            }));
        });
    });
});
//# sourceMappingURL=order.service.test.js.map