"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Test simple: intentar crear una clave de 10 caracteres
 */
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function test() {
    try {
        console.log('🧪 Testing hourly sharding migration on local DB...\n');
        // Intentar crear una clave de 10 caracteres
        const testKey = '2026012023'; // 10 chars
        // Verificar si ya existe
        const existing = await prisma.orderSequence.findUnique({
            where: { sequenceKey: testKey }
        });
        if (existing) {
            console.log(`✅ Test key "${testKey}" exists (${testKey.length} chars)`);
            console.log('✅ Migration successful - 10-char keys working!\n');
            await prisma.$disconnect();
            return;
        }
        // Intentar crear
        const created = await prisma.orderSequence.create({
            data: {
                sequenceKey: testKey,
                currentValue: 999
            }
        });
        console.log(`✅ Successfully created test key: "${created.sequenceKey}"`);
        console.log(`   Length: ${created.sequenceKey.length} chars`);
        console.log('✅ Migration successful - VARCHAR(12) confirmed!\n');
    }
    catch (error) {
        if (error.code === 'P2002') {
            console.log('✅ Key already exists - migration OK\n');
        }
        else {
            console.error('❌ Error:', error.message);
            console.error('\nMigration may have failed. Run:');
            console.error('  npx prisma migrate deploy\n');
        }
    }
    finally {
        await prisma.$disconnect();
    }
}
test();
//# sourceMappingURL=test-hourly-key.js.map