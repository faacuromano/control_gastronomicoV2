"use strict";
/**
 * Diagnostic script to check OrderSequence table structure
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkTableStructure() {
    try {
        console.log('🔍 Checking OrderSequence table structure...\n');
        // Query to get table structure
        const result = await prisma.$queryRaw `
      SHOW CREATE TABLE OrderSequence
    `;
        console.log('📋 Table Definition:');
        console.log(JSON.stringify(result, null, 2));
        // Check current data
        const data = await prisma.orderSequence.findMany();
        console.log('\n📊 Current Data:');
        console.log(data);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkTableStructure();
//# sourceMappingURL=check-table-structure.js.map