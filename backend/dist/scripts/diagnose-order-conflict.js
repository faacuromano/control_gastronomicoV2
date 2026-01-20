"use strict";
/**
 * Diagnostic: Check for existing orders on businessDate 2026-01-18
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function diagnoseOrderConflict() {
    console.log('🔍 Diagnosing Order Number Conflict\n');
    console.log('='.repeat(60));
    // Check orders for business date 2026-01-18
    const targetDate = new Date('2026-01-18');
    targetDate.setHours(0, 0, 0, 0);
    console.log(`\n📅 Checking orders for businessDate: ${targetDate.toISOString().split('T')[0]}`);
    const ordersOnDate = await prisma.order.findMany({
        where: {
            businessDate: targetDate
        },
        orderBy: { orderNumber: 'asc' },
        select: {
            id: true,
            orderNumber: true,
            businessDate: true,
            createdAt: true,
            status: true
        }
    });
    console.log(`\n📊 Found ${ordersOnDate.length} orders for this date:`);
    ordersOnDate.forEach(order => {
        console.log(`   Order #${order.orderNumber} (ID: ${order.id}) - Created: ${order.createdAt.toISOString()} - Status: ${order.status}`);
    });
    // Check OrderSequence
    const sequence = await prisma.orderSequence.findUnique({
        where: { sequenceKey: '20260118' }
    });
    console.log(`\n📋 OrderSequence for '20260118':`);
    if (sequence) {
        console.log(`   Current Value: ${sequence.currentValue}`);
        console.log(`   Created: ${sequence.createdAt.toISOString()}`);
        console.log(`   Updated: ${sequence.updatedAt.toISOString()}`);
    }
    else {
        console.log(`   ❌ No sequence exists for this date`);
    }
    // Diagnose the conflict
    if (ordersOnDate.length > 0 && sequence) {
        const maxOrderNumber = Math.max(...ordersOnDate.map(o => o.orderNumber));
        console.log(`\n🔍 Analysis:`);
        console.log(`   Maximum orderNumber in DB: ${maxOrderNumber}`);
        console.log(`   Sequence currentValue: ${sequence.currentValue}`);
        if (sequence.currentValue <= maxOrderNumber) {
            console.log(`\n❌ CONFLICT DETECTED!`);
            console.log(`   The sequence is behind the actual orders in the database.`);
            console.log(`   Next generated number would be: ${sequence.currentValue + 1}`);
            console.log(`   But order #${sequence.currentValue + 1} might already exist!`);
            const wouldConflict = ordersOnDate.find(o => o.orderNumber === sequence.currentValue + 1);
            if (wouldConflict) {
                console.log(`   ⚠️  Confirmed: Order #${wouldConflict.orderNumber} already exists (ID: ${wouldConflict.id})`);
            }
        }
        else {
            console.log(`\n✅ Sequence is ahead - no immediate conflict`);
        }
    }
    console.log('\n' + '='.repeat(60));
    await prisma.$disconnect();
}
diagnoseOrderConflict();
//# sourceMappingURL=diagnose-order-conflict.js.map