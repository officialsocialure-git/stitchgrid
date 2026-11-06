const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      memberships: {
        include: { organization: true }
      }
    }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const rfqs = await prisma.rfq.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      buyerOrgId: true,
      buyer: { select: { name: true } },
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log("RFQS COUNT:", rfqs.length);
  console.log("RFQS:", JSON.stringify(rfqs, null, 2));

  const orders = await prisma.purchaseOrder.findMany({
    select: {
      id: true,
      poNumber: true,
      status: true,
      createdAt: true
    }
  });
  console.log("ORDERS COUNT:", orders.length);

  await prisma.$disconnect();
}

inspect();

