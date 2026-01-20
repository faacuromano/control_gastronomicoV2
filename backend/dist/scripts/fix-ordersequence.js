"use strict";
/**
 * Fix OrderSequence table - Apply AUTO_INCREMENT to id column
 * This resolves P2011 error when creating new sequence records
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function fixOrderSequenceTable() {
    try {
        console.log('🔧 Applying OrderSequence table fix...\n');
        // Step 1: Drop and recreate table with correct structure
        console.log('Step 1: Dropping existing OrderSequence table...');
        await prisma.$executeRaw `DROP TABLE IF EXISTS OrderSequence`;
        console.log('Step 2: Creating OrderSequence with AUTO_INCREMENT...');
        await prisma.$executeRaw `
      CREATE TABLE OrderSequence (
        id INT NOT NULL AUTO_INCREMENT,
        sequenceKey VARCHAR(8) NOT NULL,
        currentValue INT NOT NULL DEFAULT 0,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY OrderSequence_sequenceKey_key (sequenceKey),
        KEY OrderSequence_sequenceKey_idx (sequenceKey)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
        console.log('\n✅ OrderSequence table recreated successfully!');
        console.log('📝 AUTO_INCREMENT is now enabled on the id column');
        console.log('\n🧪 Testing: Creating a test sequence record...');
        // Test the fix
        const testSequence = await prisma.orderSequence.create({
            data: {
                sequenceKey: 'TEST0001',
                currentValue: 1
            }
        });
        console.log('✅ Test record created successfully:');
        console.log(testSequence);
        // Clean up test record
        await prisma.orderSequence.delete({
            where: { id: testSequence.id }
        });
        console.log('\n🎉 Fix completed! The OrderSequence table is now ready.');
        console.log('💡 Next order creation will automatically create today\'s sequence.');
    }
    catch (error) {
        console.error('❌ Error applying fix:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
fixOrderSequenceTable();
//# sourceMappingURL=fix-ordersequence.js.map