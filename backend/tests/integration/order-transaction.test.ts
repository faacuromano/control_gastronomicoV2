import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { OrderService } from '../../src/services/order.service';
import { StockMovementService } from '../../src/services/stockMovement.service';


describe('Order Transaction Integrity', () => {
    let productId: number;
    let userId: number;
    let shiftId: number;

    beforeAll(async () => {
        // Setup clean state
        await prisma.stockMovement.deleteMany();
        await prisma.orderItem.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.order.deleteMany();
        await prisma.productIngredient.deleteMany();
        await prisma.ingredient.deleteMany();
        await prisma.product.deleteMany();
        await prisma.category.deleteMany();
        await prisma.cashShift.deleteMany();
        await prisma.user.deleteMany();
        await prisma.role.deleteMany();

        // Create dependencies
        const role = await prisma.role.create({
            data: { name: 'WAITER_TEST_TX', permissions: {} }
        });

        const user = await prisma.user.create({
            data: { name: 'Test Server TX', pinHash: '$2a$10$test.hash.for.integration.tests', roleId: role.id }
        });
        userId = user.id;

        const shift = await prisma.cashShift.create({
            data: { 
                userId: user.id, 
                startAmount: 100, 
                startTime: new Date(),
                businessDate: new Date()
            }
        });
        shiftId = shift.id;

        const cat = await prisma.category.create({ data: { name: 'Test Cat' } });
        
        const ing = await prisma.ingredient.create({
            data: { name: 'Test Ing', unit: 'kg', stock: 100, cost: 10 }
        });

        const prod = await prisma.product.create({
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
        await prisma.$disconnect();
    });

    it('should rollback order creation if stock deduction fails', async () => {
        // Arrange
        const orderService = new OrderService();
        
        // Spy on prototype/register to ensure we catch the call on the singleton instance
        const registerSpy = jest.spyOn(StockMovementService.prototype, 'register')
            .mockRejectedValue(new Error('Simulated Stock Error'));

        // Act & Assert
        const orderData = {
            userId,
            items: [{ productId, quantity: 1 }],
            serverId: userId,
            channel: 'POS' as const
        };

        // Expect createOrder to fail because of the stock error
        await expect(orderService.createOrder(orderData)).rejects.toThrow('Simulated Stock Error');

        // Verify Rollback
        // Order should NOT exist because transaction failed
        const orders = await prisma.order.findMany();
        expect(orders).toHaveLength(0);
        
        registerSpy.mockRestore();
    });
});
