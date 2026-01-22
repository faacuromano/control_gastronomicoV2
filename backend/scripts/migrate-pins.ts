/**
 * @fileoverview Migration Script for PIN Hashing
 * 
 * This script migrates existing plaintext PINs to bcrypt hashes.
 * Run ONCE after applying the pinCode -> pinHash schema migration.
 * 
 * NOTE: If the pinCode column no longer exists (already migrated),
 * this script will safely exit with a success message.
 * 
 * USAGE:
 *   npx ts-node scripts/migrate-pins.ts
 * 
 * @security P0-CATASTROPHIC remediation
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migratePins(): Promise<void> {
    console.log('🔐 Starting PIN migration to bcrypt hashes...');
    
    // First, check if pinCode column exists
    try {
        const columnCheck = await prisma.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*) as count 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'User' 
            AND COLUMN_NAME = 'pinCode'
        `;
        
        const columnExists = columnCheck && columnCheck[0] && columnCheck[0].count > 0;
        
        if (!columnExists) {
            console.log('✅ Column pinCode does not exist - migration already complete or not needed.');
            console.log('   All PINs should already be hashed in pinHash column.');
            return;
        }
    } catch (error) {
        console.log('⚠️  Could not check column existence, attempting migration anyway...');
    }
    
    // Try to read from the OLD column
    let usersWithPlaintextPin: Array<{ id: number; pinCode: string }> = [];
    
    try {
        usersWithPlaintextPin = await prisma.$queryRaw<Array<{ id: number; pinCode: string }>>`
            SELECT id, pinCode FROM User WHERE pinCode IS NOT NULL AND (pinHash IS NULL OR pinHash = '')
        `;
    } catch (error) {
        // Column doesn't exist, migration not needed
        console.log('✅ Migration not needed - pinCode column does not exist.');
        console.log('   This means the schema has already been migrated to use pinHash only.');
        return;
    }
    
    console.log(`📊 Found ${usersWithPlaintextPin.length} users with plaintext PINs to migrate`);
    
    if (usersWithPlaintextPin.length === 0) {
        console.log('✅ No users need migration. All PINs are already hashed.');
        return;
    }
    
    let migrated = 0;
    let failed = 0;
    
    for (const user of usersWithPlaintextPin) {
        try {
            const pinHash = await bcrypt.hash(user.pinCode, 10);
            
            await prisma.$executeRaw`
                UPDATE User SET pinHash = ${pinHash}, pinCode = NULL WHERE id = ${user.id}
            `;
            
            migrated++;
            console.log(`  ✅ User ${user.id}: PIN migrated`);
        } catch (error) {
            failed++;
            console.error(`  ❌ User ${user.id}: Migration failed -`, error);
        }
    }
    
    console.log('');
    console.log('📈 Migration Summary:');
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${usersWithPlaintextPin.length}`);
    
    if (failed === 0 && migrated > 0) {
        console.log('');
        console.log('🎉 All PINs successfully migrated to bcrypt hashes!');
        console.log('');
        console.log('⚠️  NEXT STEP: After verifying login works correctly, remove the pinCode column:');
        console.log('    ALTER TABLE User DROP COLUMN pinCode;');
    }
}

migratePins()
    .catch((error) => {
        console.error('Fatal error during migration:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
