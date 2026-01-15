"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../../src/lib/prisma");
const order_service_1 = require("../../src/services/order.service");
const stockMovement_service_1 = require("../../src/services/stockMovement.service");
describe('Order Transaction Integrity', () => {
    let productId;
    let userId;
    let shiftId;
    beforeAll(async () => {
        // Setup clean state
        await prisma_1.prisma.stockMovement.deleteMany();
        await prisma_1.prisma.orderItem.deleteMany();
        await prisma_1.prisma.payment.deleteMany();
        await prisma_1.prisma.order.deleteMany();
        await prisma_1.prisma.productIngredient.deleteMany();
        await prisma_1.prisma.ingredient.deleteMany();
        await prisma_1.prisma.product.deleteMany();
        await prisma_1.prisma.category.deleteMany();
        await prisma_1.prisma.cashShift.deleteMany();
        await prisma_1.prisma.user.deleteMany();
        await prisma_1.prisma.role.deleteMany();
        // Create dependencies
        const role = await prisma_1.prisma.role.create({
            data: { name: 'WAITER_TEST_TX', permissions: {} }
        });
        const user = await prisma_1.prisma.user.create({
            data: { name: 'Test Server TX', pinCode: '5566', roleId: role.id }
        });
        userId = user.id;
        const shift = await prisma_1.prisma.cashShift.create({
            data: {
                userId: user.id,
                startAmount: 100,
                startTime: new Date(),
                businessDate: new Date()
            }
        });
        shiftId = shift.id;
        const cat = await prisma_1.prisma.category.create({ data: { name: 'Test Cat' } });
        const ing = await prisma_1.prisma.ingredient.create({
            data: { name: 'Test Ing', unit: 'kg', stock: 100, cost: 10 }
        });
        const prod = await prisma_1.prisma.product.create({
            data: {
                name: 'Test Transaction Burger',
                price: 100,
                categoryId: cat.id,
                isStockable: true,
                ingredients: {
                    create: [{ ingredientId: ing.id, quantity: 1 }]
                }
            }
        });
        productId = prod.id;
    });
    afterAll(async () => {
        await prisma_1.prisma.$disconnect();
    });
    it('should rollback order creation if stock deduction fails', async () => {
        // Arrange
        const orderService = new order_service_1.OrderService();
        // Spy on prototype/register to ensure we catch the call on the singleton instance
        const registerSpy = jest.spyOn(stockMovement_service_1.StockMovementService.prototype, 'register')
            .mockRejectedValue(new Error('Simulated Stock Error'));
        // Act & Assert
        const orderData = {
            items: [{ productId, quantity: 1 }],
            serverId: userId,
            channel: 'POS'
        };
        // Expect createOrder to fail because of the stock error
        await expect(orderService.createOrder(orderData)).rejects.toThrow('Simulated Stock Error');
        // Verify Rollback
        // Order should NOT exist because transaction failed
        const orders = await prisma_1.prisma.order.findMany();
        expect(orders).toHaveLength(0);
        registerSpy.mockRestore();
    });
});
//# sourceMappingURL=order-transaction.test.js.map