const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log("=== STARTING CLEANUP OF PREVIOUS / PREDEFINED / TEST DATA ===");

  // 1. Delete all payments
  const deletedPayments = await prisma.paymentTransaction.deleteMany({});
  console.log(`Deleted ${deletedPayments.count} payment transactions.`);

  // 2. Delete all samples
  const deletedSamples = await prisma.sample.deleteMany({});
  console.log(`Deleted ${deletedSamples.count} samples.`);

  // 3. Delete order milestones, order events, order items
  const deletedMilestones = await prisma.orderMilestone.deleteMany({});
  const deletedEvents = await prisma.orderEvent.deleteMany({});
  const deletedOrderItems = await prisma.purchaseOrderItem.deleteMany({});
  console.log(`Deleted ${deletedMilestones.count} milestones, ${deletedEvents.count} order events, ${deletedOrderItems.count} order items.`);

  // 4. Delete purchase orders
  const deletedOrders = await prisma.purchaseOrder.deleteMany({});
  console.log(`Deleted ${deletedOrders.count} purchase orders.`);

  // 5. Delete quotation items and quotations
  const deletedQuoteItems = await prisma.quotationItem.deleteMany({});
  const deletedQuotes = await prisma.quotation.deleteMany({});
  console.log(`Deleted ${deletedQuoteItems.count} quotation items, ${deletedQuotes.count} quotations.`);

  // 6. Delete RFQ items, invitations, and RFQs
  const deletedRfqItems = await prisma.rfqItem.deleteMany({});
  const deletedInvitations = await prisma.rfqInvitation.deleteMany({});
  const deletedRfqs = await prisma.rfq.deleteMany({});
  console.log(`Deleted ${deletedRfqItems.count} RFQ items, ${deletedInvitations.count} RFQ invitations, ${deletedRfqs.count} RFQs.`);

  // 7. Delete messages and conversations
  const deletedMessages = await prisma.message.deleteMany({});
  const deletedConvs = await prisma.conversation.deleteMany({});
  console.log(`Deleted ${deletedMessages.count} messages, ${deletedConvs.count} conversations.`);

  // 8. Delete reviews and disputes
  const deletedReviews = await prisma.review.deleteMany({});
  const deletedDisputes = await prisma.dispute.deleteMany({});
  console.log(`Deleted ${deletedReviews.count} reviews, ${deletedDisputes.count} disputes.`);

  // 9. Predefined seeded suppliers to remove:
  // Northstar, Weavecraft, Label & Loop, Precision Print, Sri Balaji, and test users
  const emailsToRemove = [
    'suresh@northstarapparel.in',
    'rajesh@weavecraft.in',
    'neha@labelandloop.in',
    'vikas@precisionprint.in',
    'balaji@sribalajigarments.com'
  ];

  // Also remove test script accounts (buyer_..., supplier_...)
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emailsToRemove } },
        { email: { startsWith: 'buyer_' } },
        { email: { startsWith: 'supplier_' } }
      ]
    },
    include: {
      memberships: { select: { organizationId: true } }
    }
  });

  console.log(`Found ${testUsers.length} predefined / test users to remove.`);

  for (const user of testUsers) {
    const orgIds = user.memberships.map(m => m.organizationId);

    // Delete supplier profile, categories, catalog items for these orgs
    const profiles = await prisma.supplierProfile.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
    const profileIds = profiles.map(p => p.id);

    if (profileIds.length > 0) {
      await prisma.catalogItem.deleteMany({ where: { supplierProfileId: { in: profileIds } } });
      await prisma.supplierCategory.deleteMany({ where: { supplierProfileId: { in: profileIds } } });
      await prisma.supplierProfile.deleteMany({ where: { id: { in: profileIds } } });
    }

    // Delete memberships & refresh tokens & audit logs
    await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });

    // Delete user
    await prisma.user.delete({ where: { id: user.id } });

    // Delete organization if not owned by any other member
    for (const orgId of orgIds) {
      const remainingMembers = await prisma.organizationMember.count({ where: { organizationId: orgId } });
      if (remainingMembers === 0) {
        await prisma.organization.delete({ where: { id: orgId } });
      }
    }
  }

  // 10. Also approve user 'meldima comfort' organization so it's a verified supplier!
  const meldima = await prisma.organization.findFirst({
    where: { name: { contains: 'meldima' } }
  });
  if (meldima) {
    await prisma.organization.update({
      where: { id: meldima.id },
      data: {
        verificationStatus: 'APPROVED',
        legalName: 'Meldima Comfort Garments Pvt. Ltd.',
        businessType: 'Garment manufacturer',
        city: 'Noida, UP'
      }
    });

    // Ensure meldima has a supplier profile so it shows cleanly in supplier directory
    const existingProfile = await prisma.supplierProfile.findUnique({
      where: { organizationId: meldima.id }
    });
    if (!existingProfile) {
      const newProf = await prisma.supplierProfile.create({
        data: {
          organizationId: meldima.id,
          description: 'Specialized activewear and knits manufacturer. MOQ: 200 pcs | Capacity: 15,000 pcs / month | Tags: Activewear · Knits · Cut & Sew',
          yearsInBusiness: 6,
          productionCapacity: 15000,
          verificationStatus: 'APPROVED',
          categories: {
            create: [
              { category: 'Garment' },
              { category: 'Activewear' }
            ]
          },
          catalogItems: {
            create: [
              { name: 'Activewear Gym Tees', itemType: 'Garment', moq: 200, unitPrice: 320, currency: 'INR' },
              { name: 'Performance Track Pants', itemType: 'Garment', moq: 200, unitPrice: 550, currency: 'INR' }
            ]
          }
        }
      });
      console.log('Created rich profile for verified supplier meldima comfort.');
    } else {
      await prisma.supplierProfile.update({
        where: { id: existingProfile.id },
        data: {
          verificationStatus: 'APPROVED',
          description: 'Specialized activewear and knits manufacturer. MOQ: 200 pcs | Capacity: 15,000 pcs / month | Tags: Activewear · Knits · Cut & Sew',
        }
      });
    }
  }

  console.log("\n=== CLEANUP COMPLETE ===");
  await prisma.$disconnect();
}

cleanup().catch(console.error);

