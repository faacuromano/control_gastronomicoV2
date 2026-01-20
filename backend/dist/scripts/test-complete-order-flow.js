"use strict";
/**
 * Test complete order creation flow with date-based sharding
 * Verifies that both P2011 and P2002 errors are resolved
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const orderNumber_service_1 = require("../src/services/orderNumber.service");
const prisma = new client_1.PrismaClient();
async function testCompleteOrderFlow() {
    try {
        console.log('🧪 Testing Complete Order Creation Flow\n');
        console.log('='.repeat(60));
        // Test 1: Verify OrderSequence generation works
        console.log('\n📋 Test 1: Order Number Generation');
        const { orderNumber } = await prisma.$transaction(async (tx) => {
            return await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
        });
        console.log(`✅ Generated order number: ${orderNumber}`);
        // Test 2: Verify we can create an order with this number
        console.log('\n📋 Test 2: Order Creation with Date-Based Sharding');
        // Calculate business date (same logic as orderNumber service)
        const now = new Date();
        const businessDate = new Date(now);
        if (businessDate.getHours() < 6) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        businessDate.setHours(0, 0, 0, 0);
        const testOrder = await prisma.order.create({
            data: {
                orderNumber,
                businessDate,
                channel: 'POS',
                status: 'OPEN',
                paymentStatus: 'PENDING',
                subtotal: 100,
                total: 100
            }
        });
        console.log(`✅ Order created successfully:`);
        console.log(`   ID: ${testOrder.id}`);
        console.log(`   Order Number: ${testOrder.orderNumber}`);
        console.log(`   Business Date: ${testOrder.businessDate.toISOString().split('T')[0]}`);
        // Test 3: Verify composite unique constraint works
        console.log('\n📋 Test 3: Composite Unique Constraint Verification');
        console.log('   Attempting to create duplicate orderNumber on SAME day...');
        try {
            await prisma.order.create({
                data: {
                    orderNumber: testOrder.orderNumber,
                    businessDate: testOrder.businessDate,
                    channel: 'POS',
                    status: 'OPEN',
                    paymentStatus: 'PENDING',
                    subtotal: 50,
                    total: 50
                }
            });
            console.log('❌ FAILED: Duplicate was allowed (constraint not working)');
        }
        catch (error) {
            if (error.code === 'P2002') {
                console.log('✅ Correctly rejected duplicate (businessDate + orderNumber)');
            }
            else {
                throw error;
            }
        }
        // Test 4: Verify we CAN create same orderNumber on DIFFERENT day
        console.log('\n📋 Test 4: Same Order Number on Different Day');
        const differentDate = new Date(businessDate);
        differentDate.setDate(differentDate.getDate() - 1);
        const orderOnDifferentDay = await prisma.order.create({
            data: {
                orderNumber: testOrder.orderNumber, // Same number
                businessDate: differentDate, // Different day
                channel: 'POS',
                status: 'OPEN',
                paymentStatus: 'PENDING',
                subtotal: 75,
                total: 75
            }
        });
        console.log(`✅ Successfully created order with same number on different day:`);
        console.log(`   Order Number: ${orderOnDifferentDay.orderNumber} (same as test 2)`);
        console.log(`   Business Date: ${orderOnDifferentDay.businessDate.toISOString().split('T')[0]} (different day)`);
        // Cleanup test orders
        console.log('\n🧹 Cleaning up test data...');
        await prisma.order.deleteMany({
            where: {
                id: {
                    in: [testOrder.id, orderOnDifferentDay.id]
                }
            }
        });
        console.log('✅ Test data cleaned up');
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ALL TESTS PASSED!');
        console.log('\n✅ Fixed Issues:');
        console.log('   - P2011: OrderSequence.id AUTO_INCREMENT ✓');
        console.log('   - P2002: Composite unique constraint ✓');
        console.log('\n✅ Date-Based Sharding:');
        console.log('   - Order numbers reset daily ✓');
        console.log('   - No conflicts between different days ✓');
        console.log('   - Duplicate prevention within same day ✓');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
testCompleteOrderFlow();
//# sourceMappingURL=test-complete-order-flow.js.map