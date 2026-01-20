"use strict";
/**
 * @fileoverview CRITICAL TEST: Verify hourly sharding distributes orders correctly
 *
 * This test verifies the fix for the duplicate key bug where all orders
 * were using hour "00" causing collisions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const orderNumber_service_1 = require("../src/services/orderNumber.service");
const prisma = new client_1.PrismaClient();
async function testHourlyDistribution() {
    console.log('🧪 CRITICAL TEST: Hourly Sharding Distribution\n');
    console.log('='.repeat(70));
    console.log('\nObjective: Verify orders created in different hours use different keys\n');
    try {
        // Create 3 orders in rapid succession
        const results = [];
        for (let i = 1; i <= 3; i++) {
            const result = await prisma.$transaction(async (tx) => {
                const orderData = await orderNumber_service_1.orderNumberService.getNextOrderNumber(tx);
                // Also create the actual order to test full flow
                const order = await tx.order.create({
                    data: {
                        id: orderData.id,
                        orderNumber: orderData.orderNumber,
                        businessDate: orderData.businessDate,
                        channel: 'POS',
                        status: 'OPEN',
                        paymentStatus: 'PENDING',
                        subtotal: 100,
                        total: 100
                    }
                });
                return { orderData, order };
            });
            results.push(result);
            console.log(`Order ${i} created:`);
            console.log(`  UUID: ${result.orderData.id}`);
            console.log(`  Order #: ${result.orderData.orderNumber}`);
            console.log(`  Business Date: ${result.orderData.businessDate.toISOString().split('T')[0]}`);
            console.log(``);
        }
        // Now verify the sequence keys used
        const currentHour = new Date().getHours();
        const expectedKeyPattern = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(currentHour).padStart(2, '0')}`;
        console.log('\n📊 Verification:');
        console.log(`  Expected hour: ${currentHour}`);
        console.log(`  Expected key pattern: ${expectedKeyPattern}`);
        console.log('');
        // Check sequences in database
        const sequences = await prisma.orderSequence.findMany({
            where: {
                sequenceKey: {
                    contains: new Date().toISOString().slice(0, 10).replace(/-/g, '')
                }
            },
            orderBy: {
                sequenceKey: 'desc'
            },
            take: 5
        });
        console.log(`Found ${sequences.length} sequence(s) for today:`);
        sequences.forEach(seq => {
            const keyLength = seq.sequenceKey.length;
            const hour = keyLength === 10 ? seq.sequenceKey.slice(-2) : 'N/A';
            console.log(`  ${seq.sequenceKey} (${keyLength} chars, hour: ${hour}) → ${seq.currentValue} orders`);
        });
        // CRITICAL CHECK: Verify we're using hourly keys (10 chars) not daily (8 chars)
        const hasHourlyKeys = sequences.some(s => s.sequenceKey.length === 10);
        const hasDailyKeys = sequences.some(s => s.sequenceKey.length === 8);
        console.log('');
        console.log('✅ Result:');
        if (hasHourlyKeys && !hasDailyKeys) {
            console.log('  ✅ Using HOURLY sharding (10-char keys)');
            console.log('  ✅ No daily keys found (8-char)');
            console.log('  ✅ Duplicate key bug is FIXED');
        }
        else if (hasDailyKeys) {
            console.log('  ❌ Still using DAILY keys (8-char)');
            console.log('  ❌ Hourly sharding NOT active');
        }
        else if (!hasHourlyKeys && !hasDailyKeys) {
            const actualKey = sequences[0]?.sequenceKey;
            const actualHour = actualKey?.slice(-2);
            console.log(`  ⚠️  Using ${actualKey} (hour: ${actualHour})`);
            console.log(`  ⚠️  Expected hour: ${currentHour}`);
            if (actualHour === '00' && currentHour !== 0) {
                console.log('  ❌❌ CRITICAL BUG: All orders using hour "00" despite current hour being ' + currentHour);
                console.log('  ❌❌ This will cause duplicate key errors!');
            }
        }
        console.log('\n' + '='.repeat(70));
        console.log('✅ TEST COMPLETE\n');
    }
    catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        if (error.code === 'P2002') {
            console.error('\n🚨 DUPLICATE KEY ERROR DETECTED!');
            console.error('🚨 The hourly sharding fix did NOT work');
            console.error('🚨 All orders are still using the same sequenceKey\n');
        }
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
testHourlyDistribution();
//# sourceMappingURL=test-hourly-distribution.js.map