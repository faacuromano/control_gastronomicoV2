
// Use require for compatibility if standard import fails in quick script
const { orderService } = require('./src/services/order.service');
const { prisma } = require('./src/lib/prisma');

async function main() {
  console.log('--- Starting Delivery Order Verification (CommonJS) ---');

  // 1. Get a random product, user (server) and client
  const product = await prisma.product.findFirst({ where: { isActive: true } });
  const server = await prisma.user.findFirst();
  const client = await prisma.client.findFirst();

  if (!product || !server || !client) {
    console.error('Missing prerequisites: Product, Server or Client not found');
    return;
  }

  // Ensure server has an open shift
  let shift = await prisma.cashShift.findFirst({
      where: { userId: server.id, endTime: null }
  });

  if (!shift) {
      console.log('Opening shift for server...');
      shift = await prisma.cashShift.create({
          data: {
              userId: server.id,
              startAmount: 100,
              businessDate: new Date()
          }
      });
  }

  console.log(`Creating order with Channel: DELIVERY_APP and Address...`);

  // 2. Create Order simulating POS
  try {
      const order = await orderService.createOrder({
          userId: server.id,
          serverId: server.id,
          items: [{ productId: product.id, quantity: 1, unitPrice: Number(product.price), status: 'PENDING' }],
          paymentMethod: 'CASH',
          channel: 'DELIVERY_APP', // Simulating POSPage logic
          deliveryData: {
              address: 'Test Address 123',
              name: 'Test Client',
              phone: '123456789',
              notes: 'Test Notes'
          },
          clientId: client.id
      });
      
      console.log(`Order created: #${order.orderNumber} (ID: ${order.id})`);
      console.log(`Order Status: ${order.status}`);
      console.log(`Order Channel: ${order.channel}`);
      console.log(`Order Address: ${order.deliveryAddress}`);

      // 3. Fetch Delivery Orders
      console.log('\nFetching Delivery Orders...');
      const deliveryOrders = await orderService.getDeliveryOrders();
      
      const found = deliveryOrders.find((o: any) => o.id === order.id);
      
      if (found) {
          console.log('SUCCESS: Order found in getDeliveryOrders()');
          console.log(`Found Order Status: ${found.status}`);
          console.log(`Found Order Channel: ${found.channel}`);
      } else {
          console.error('FAILURE: Order NOT found in getDeliveryOrders()');
          console.log('Active Delivery Order IDs:', deliveryOrders.map((o: any) => o.id));
      }

  } catch (error) {
      console.error('Error creating order:', error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
