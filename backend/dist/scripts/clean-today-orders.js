"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Clean orders and sequences for today's business date to resolve duplicates
 */
const prisma_1 = require("../src/lib/prisma");
const businessDate_1 = require("../src/utils/businessDate");
async function cleanTodayData() {
    console.log('🧹 Cleaning today\'s orders and sequence...\n');
    const sequenceKey = (0, businessDate_1.getBusinessDateKey)();
    console.log(`Business date key: ${sequenceKey}\n`);
    try {
        // 1. Check existing orders for today
        const existingOrders = await prisma_1.prisma.order.findMany({
            where: {
                businessDate: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            },
            select: {
                id: true,
                orderNumber: true,
                businessDate: true,
                channel: true,
                total: true
            }
        });
        console.log(`Found ${existingOrders.length} orders for today:`);
        existingOrders.forEach(order => {
            console.log(`  - Order #${order.orderNumber} (ID: ${order.id}, ${order.channel}, $${order.total})`);
        });
        console.log('');
        // 2. Check sequence
        const sequence = await prisma_1.prisma.orderSequence.findUnique({
            where: { sequenceKey }
        });
        if (sequence) {
            console.log(`Current sequence: ${sequence.currentValue}\n`);
        }
        else {
            console.log('No sequence found for today\n');
        }
        // 3. Delete today's orders
        const deleteResult = await prisma_1.prisma.order.deleteMany({
            where: {
                businessDate: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        console.log(`✅ Deleted ${deleteResult.count} orders\n`);
        // 4. Reset sequence
        if (sequence) {
            await prisma_1.prisma.orderSequence.delete({
                where: { sequenceKey }
            });
            console.log('✅ Deleted sequence for today\n');
        }
        console.log('✨ Cleanup complete! You can now create orders without duplicates.\n');
    }
    catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
cleanTodayData()
    .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=clean-today-orders.js.map