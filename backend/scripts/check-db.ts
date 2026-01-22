
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking OrderSequence table...');
  const sequences = await prisma.orderSequence.findMany();
  console.log(JSON.stringify(sequences, null, 2));
  
  const orders = await prisma.order.findMany({
      select: { orderNumber: true, businessDate: true, uuid: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20
  });
  console.log('Recent Orders:', JSON.stringify(orders, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
