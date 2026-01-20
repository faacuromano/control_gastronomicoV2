"use strict";
/**
 * Apply Order table schema changes for P1-001 date-based sharding
 * Changes the unique constraint from orderNumber alone to (businessDate, orderNumber)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function applySchemaChanges() {
    try {
        console.log('🔧 Applying Order table schema changes for date-based sharding...\n');
        // Step 1: Drop the old unique constraint on orderNumber
        console.log('Step 1: Dropping old unique constraint on orderNumber...');
        await prisma.$executeRaw `
      ALTER TABLE \`Order\` DROP INDEX \`Order_orderNumber_key\`
    `;
        console.log('✅ Old constraint dropped');
        // Step 2: Add composite unique constraint on (businessDate, orderNumber)
        console.log('\nStep 2: Creating composite unique constraint on (businessDate, orderNumber)...');
        await prisma.$executeRaw `
      ALTER TABLE \`Order\` ADD UNIQUE INDEX \`Order_businessDate_orderNumber_key\` (\`businessDate\`, \`orderNumber\`)
    `;
        console.log('✅ Composite unique constraint created');
        // Step 3: Add index on orderNumber for performance
        console.log('\nStep 3: Adding index on orderNumber for fast lookups...');
        await prisma.$executeRaw `
      ALTER TABLE \`Order\` ADD INDEX \`Order_orderNumber_idx\` (\`orderNumber\`)
    `;
        console.log('✅ Index created');
        console.log('\n🎉 Schema changes applied successfully!');
        console.log('\n📋 Summary:');
        console.log('  - Removed: UNIQUE constraint on orderNumber');
        console.log('  - Added: UNIQUE constraint on (businessDate, orderNumber)');
        console.log('  - Added: INDEX on orderNumber');
        console.log('\n✅ Date-based sharding is now fully operational!');
        console.log('   Order numbers can now reset daily without conflicts.');
    }
    catch (error) {
        console.error('\n❌ Error applying schema changes:', error.message);
        // Check if constraint already exists
        if (error.code === 'P2010' || error.message?.includes('Duplicate')) {
            console.log('\n💡 The constraint may already exist. Verifying...');
            const result = await prisma.$queryRaw `
        SHOW INDEX FROM \`Order\` WHERE Key_name = 'Order_businessDate_orderNumber_key'
      `;
            if (Array.isArray(result) && result.length > 0) {
                console.log('✅ Composite constraint already exists - schema is correct!');
            }
        }
        else {
            throw error;
        }
    }
    finally {
        await prisma.$disconnect();
    }
}
applySchemaChanges();
//# sourceMappingURL=apply-order-constraint-fix.js.map