"use strict";
/**
 * ONE-TIME MIGRATION: Synchronize OrderSequence with existing Order data
 *
 * This script fixes the desynchronization issue where OrderSequence.currentValue
 * is lower than the actual MAX(orderNumber) for a given businessDate.
 *
 * This happens when:
 * 1. The OrderSequence table was dropped/recreated
 * 2. Data was imported from another source
 * 3. Manual database modifications were made
 *
 * Usage:
 *   npx ts-node backend/scripts/sync-order-sequences.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function syncOrderSequences() {
    console.log('🔄 Synchronizing OrderSequence with existing Orders\n');
    console.log('='.repeat(60));
    try {
        // Get all distinct businessDates from existing orders
        const distinctDates = await prisma.$queryRaw `
      SELECT DISTINCT businessDate 
      FROM \`Order\`
      ORDER BY businessDate DESC
    `;
        console.log(`\n📅 Found ${distinctDates.length} distinct business dates with orders\n`);
        let synced = 0;
        let created = 0;
        let skipped = 0;
        for (const { businessDate } of distinctDates) {
            // Format date as YYYYMMDD
            const year = businessDate.getFullYear();
            const month = String(businessDate.getMonth() + 1).padStart(2, '0');
            const day = String(businessDate.getDate()).padStart(2, '0');
            const sequenceKey = `${year}${month}${day}`;
            // Get MAX orderNumber for this date
            const result = await prisma.order.aggregate({
                where: { businessDate },
                _max: { orderNumber: true }
            });
            const maxOrderNumber = result._max.orderNumber || 0;
            if (maxOrderNumber === 0) {
                console.log(`⏭️  ${sequenceKey}: No orders found, skipping`);
                skipped++;
                continue;
            }
            // Check if sequence exists
            const existingSequence = await prisma.orderSequence.findUnique({
                where: { sequenceKey }
            });
            if (existingSequence) {
                // Update if behind
                if (existingSequence.currentValue < maxOrderNumber) {
                    await prisma.orderSequence.update({
                        where: { sequenceKey },
                        data: { currentValue: maxOrderNumber }
                    });
                    console.log(`✅ ${sequenceKey}: Updated sequence from ${existingSequence.currentValue} → ${maxOrderNumber}`);
                    synced++;
                }
                else {
                    console.log(`✓  ${sequenceKey}: Sequence already correct (${existingSequence.currentValue})`);
                    skipped++;
                }
            }
            else {
                // Create new sequence
                await prisma.orderSequence.create({
                    data: {
                        sequenceKey,
                        currentValue: maxOrderNumber
                    }
                });
                console.log(`🆕 ${sequenceKey}: Created new sequence starting at ${maxOrderNumber}`);
                created++;
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('✅ Synchronization Complete!\n');
        console.log(`📊 Summary:`);
        console.log(`   Total dates processed: ${distinctDates.length}`);
        console.log(`   Sequences updated: ${synced}`);
        console.log(`   Sequences created: ${created}`);
        console.log(`   Already correct/skipped: ${skipped}`);
        console.log('\n🎉 All OrderSequences are now synchronized with Order data.');
        console.log('   New orders will start from the correct number for each day.');
    }
    catch (error) {
        console.error('\n❌ Synchronization failed:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
syncOrderSequences();
//# sourceMappingURL=sync-order-sequences.js.map