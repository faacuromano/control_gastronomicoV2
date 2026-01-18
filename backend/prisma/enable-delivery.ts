import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    // Enable delivery feature
    await prisma.tenantConfig.update({
        where: { id: 1 },
        data: { enableDelivery: true }
    });
    console.log('✅ Delivery enabled!');
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
