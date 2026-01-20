"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Verificación rápida de la migración en base de datos local
 */
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function verify() {
    try {
        console.log('🔍 Verificando migración en base de datos local...\n');
        // Verificar esquema
        const result = await prisma.$queryRaw `
      SELECT COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'control_gastronomico_v2'
        AND TABLE_NAME = 'OrderSequence'
        AND COLUMN_NAME = 'sequenceKey'
    `;
        if (result.length > 0) {
            const col = result[0];
            console.log(`  Tipo de columna: ${col.COLUMN_TYPE}`);
            console.log(`  Longitud máxima: ${col.CHARACTER_MAXIMUM_LENGTH} caracteres\n`);
            if (col.CHARACTER_MAXIMUM_LENGTH === 12) {
                console.log('✅ MIGRACIÓN EXITOSA - VARCHAR(12) confirmado');
                console.log('✅ La base de datos local está lista para hourly sharding\n');
            }
            else {
                console.log(`❌ MIGRACIÓN PENDIENTE - Encontrado VARCHAR(${col.CHARACTER_MAXIMUM_LENGTH})`);
                console.log('   Se esperaba VARCHAR(12)\n');
            }
        }
        else {
            console.log('❌ No se pudo verificar la tabla OrderSequence\n');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
verify();
//# sourceMappingURL=verify-local-migration.js.map