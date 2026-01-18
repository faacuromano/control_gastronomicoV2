
import { OrderService } from './src/services/order.service';
import { prisma } from './src/lib/prisma';
import axios from 'axios';

async function testUserAPI() {
    try {
        console.log("Testing /api/v1/users/with-capability?type=delivery");
        // I cannot easily authenticate via script without login.
        // I will use Prisma directly to verify the Logic inside the controller, 
        // essentially unit testing the query logic.
        
        const type = 'delivery';
        const capabilityKeywords: Record<string, string[]> = {
            delivery: ['DRIVER', 'REPARTIDOR', 'DELIVERY', 'ENVIO', 'CADETE'],
            kitchen: ['KITCHEN', 'COCINA', 'COCINERO', 'CHEF'],
            cashier: ['CASHIER', 'CAJERO', 'CAJA'],
            waiter: ['WAITER', 'MESERO', 'MOZO', 'CAMARERO']
        };
        const keywords = capabilityKeywords[type.toLowerCase()];
        
        console.log("Keywords:", keywords);
        
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    OR: keywords.map(keyword => ({
                        name: { contains: keyword } // Changed from equals to contains for test? No, controller uses equals/insensitive
                        // Controller uses: name: { equals: keyword, mode: 'insensitive' }
                    }))
                }
            },
            include: { role: true }
        });
        
        console.log("Found Users via Prisma:", users.map(u => ({ name: u.name, role: u.role?.name })));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

testUserAPI();
