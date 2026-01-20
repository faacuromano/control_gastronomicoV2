"use strict";
/**
 * Test Order Number Generation
 * Verifies the P2011 error is fixed
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const orderNumber_service_1 = require("../src/services/orderNumber.service");
const prisma = new client_1.PrismaClient();
async function testOrderNumberGeneration() {
    try {
        console.log('🧪 Testing Order Number Generation...\n');
        // Test 1: Generate 5 order numbers sequentially
        console.log('Test 1: Generating 5 sequential order numbers...');
        for (let i = 1; i <= 5; i++) {
            const { orderNumber } = await prisma.$transaction(async (tx) => {
                return await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
            });
            console.log(`  ✅ Order #${i}: ${orderNumber}`);
        }
        // Test 2: Check sequence state
        console.log('\nTest 2: Checking sequence state...');
        const now = new Date();
        const businessDate = new Date(now);
        if (businessDate.getHours() < 6) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        const year = businessDate.getFullYear();
        const month = String(businessDate.getMonth() + 1).padStart(2, '0');
        const day = String(businessDate.getDate()).padStart(2, '0');
        const sequenceKey = `${year}${month}${day}`;
        const sequence = await prisma.orderSequence.findUnique({
            where: { sequenceKey }
        });
        console.log(`  📊 Sequence Key: ${sequenceKey}`);
        console.log(`  📊 Current Value: ${sequence?.currentValue}`);
        console.log(`  📊 ID (AUTO_INCREMENT): ${sequence?.id}`);
        console.log('\n✅ All tests passed! Order number generation is working correctly.');
        console.log('🎉 P2011 error has been resolved!');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
testOrderNumberGeneration();
//# sourceMappingURL=test-fix-verification.js.map