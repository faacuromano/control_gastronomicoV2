
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Multi-Tenancy Safe Migration (Fixed Casing)...');

    // 1. Create Default Tenant
    console.log('Step 1: Creating/Ensuring Default Tenant...');
    const defaultTenant = await prisma.tenant.upsert({
        where: { code: 'default' },
        update: {},
        create: {
            name: 'Default Tenant',
            code: 'default'
        }
    });
    console.log(`✅ Default Tenant ID: ${defaultTenant.id}`);

    const tenantId = defaultTenant.id;

    // 2. Backfill tenantId for all tables
    // Use correct camelCase property names of PrismaClient
    const models = [
        'user', 'product', 'category', 'table', 'area', 'client',
        'order', 'orderSequence', 'cashShift', 'invoice', 
        'printer', 'tenantConfig'
    ];

    console.log('Step 2: Backfilling tenantId for all tables...');
    for (const model of models) {
        // @ts-ignore
        if (!prisma[model]) {
            console.error(`❌ Model property '${model}' not found on PrismaClient`);
            continue;
        }
        
        // @ts-ignore
        const result = await prisma[model].updateMany({
            where: { tenantId: null },
            data: { tenantId }
        });
        console.log(`Updated ${result.count} rows in ${model}`);
    }

    // 3. Migrate Delivery Platforms
    console.log('Step 3: Migrating Delivery Credentials to TenantPlatformConfig...');
    const platforms = await prisma.deliveryPlatform.findMany();

    for (const platform of platforms) {
        // Check if legacy fields have data
        // Note: apiKey/storeId are optional strings
        if (platform.apiKey || platform.storeId) {
            console.log(`Migrating credentials for Platform: ${platform.name}`);
            
            await prisma.tenantPlatformConfig.upsert({
                where: {
                    tenantId_deliveryPlatformId: {
                        tenantId,
                        deliveryPlatformId: platform.id
                    }
                },
                update: {
                    apiKey: platform.apiKey,
                    storeId: platform.storeId,
                    webhookSecret: platform.webhookSecret,
                    isActive: platform.isEnabled
                },
                create: {
                    tenantId,
                    deliveryPlatformId: platform.id,
                    apiKey: platform.apiKey,
                    storeId: platform.storeId,
                    webhookSecret: platform.webhookSecret,
                    isActive: platform.isEnabled
                }
            });
        }
    }
    console.log('✅ Delivery Platforms Migrated.');

    console.log('🏁 Migration Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
