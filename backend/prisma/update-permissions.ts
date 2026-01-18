import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Updating role permissions...');

    // Update each role with module access permissions
    const updates = [
        { 
            name: 'ADMIN', 
            permissions: { 
                pos: ['access', 'create', 'read', 'update', 'delete'],
                tables: ['access', 'create', 'read', 'update', 'delete'],
                cash: ['access', 'create', 'read', 'update', 'delete'],
                kds: ['access'],
                delivery: ['access'],
                admin: ['access'],
                orders: ['create', 'read', 'update', 'delete'],
                products: ['create', 'read', 'update', 'delete'],
                users: ['create', 'read', 'update', 'delete'],
                settings: ['read', 'update']
            } 
        },
        { 
            name: 'CASHIER', 
            permissions: { 
                pos: ['access', 'create', 'read'],
                cash: ['access', 'read', 'update'],
                tables: ['access', 'read'],
                orders: ['create', 'read']
            } 
        },
        { 
            name: 'WAITER', 
            permissions: { 
                pos: ['access', 'create', 'read', 'update'],
                tables: ['access', 'read', 'update'],
                orders: ['create', 'read', 'update']
            } 
        },
        { 
            name: 'KITCHEN', 
            permissions: { 
                kds: ['access'],
                orders: ['read', 'update']
            } 
        },
        { 
            name: 'DELIVERY', 
            permissions: { 
                delivery: ['access'],
                orders: ['read', 'update']
            } 
        },
    ];

    for (const role of updates) {
        await prisma.role.update({
            where: { name: role.name },
            data: { permissions: role.permissions }
        });
        console.log(`✅ Updated ${role.name}`);
    }

    console.log('🚀 Done!');
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
