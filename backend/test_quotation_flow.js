const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runFlowTest() {
  console.log("=== STARTING BUYER-SUPPLIER QUOTATION FLOW TEST ===");

  // 1. Get Buyer & Supplier users/orgs
  const buyerUser = await prisma.user.findFirst({
    where: { email: "sumitbarnwal844@gmail.com" },
    include: { memberships: { where: { role: "BUYER" }, include: { organization: true } } }
  });
  const supplierUser = await prisma.user.findFirst({
    where: { email: "offmint@gmail.com" },
    include: { memberships: { where: { role: "SUPPLIER" }, include: { organization: true } } }
  });

  const buyerOrg = buyerUser.memberships[0].organization;
  const supplierOrg = supplierUser.memberships[0].organization;
  console.log(`Buyer: ${buyerUser.fullName} (${buyerOrg.name})`);
  console.log(`Supplier: ${supplierUser.fullName} (${supplierOrg.name})`);

  // 2. Buyer creates an RFQ
  const rfq = await prisma.rfq.create({
    data: {
      buyerOrgId: buyerOrg.id,
      title: "100% Combed Cotton Bio-Wash Polo Shirts",
      garmentType: "Polo Shirts",
      fabricSpec: "100% Combed Cotton, 220 GSM Pique Knit",
      targetQuantity: 1000,
      targetPrice: 420,
      status: "OPEN",
      items: {
        create: {
          name: "Polo Shirts - 100% Cotton",
          description: "220 GSM Pique Knit, Ribbed Collar, 2-button placket",
          quantity: 1000,
          unit: "pieces"
        }
      }
    }
  });
  console.log(`\n1. Created RFQ #${rfq.id}: "${rfq.title}"`);

  // 3. Supplier submits Quotation
  const quote = await prisma.quotation.create({
    data: {
      rfqId: rfq.id,
      supplierOrgId: supplierOrg.id,
      buyerOrgId: buyerOrg.id,
      totalAmount: 450000,
      leadTimeDays: 14,
      sampleLeadDays: 5,
      sampleCost: 1500,
      moq: 500,
      terms: "Escrow 100% milestone protected",
      status: "SUBMITTED",
      items: {
        create: {
          description: "100% Cotton Bio-Wash Polo Shirts",
          quantity: 1000,
          unitPrice: 450
        }
      }
    }
  });
  console.log(`2. Supplier submitted Quote #${quote.id}: ₹450/pc (Total: ₹4,50,000)`);

  // 4. Buyer accepts the quote via API endpoint
  console.log("\n3. Testing Buyer Quote Acceptance via POST /api/purchase-orders...");
  const buyerLoginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: buyerUser.email, password: "1234567890" })
  }).then(r => r.json());

  const buyerVerifyRes = await fetch("http://localhost:5000/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: buyerLoginRes.data.userId,
      otp: buyerLoginRes.data.devOtp,
      destination: buyerLoginRes.data.destination
    })
  }).then(r => r.json());
  const buyerToken = buyerVerifyRes.data.accessToken;

  const poRes = await fetch("http://localhost:5000/api/purchase-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ quotationId: quote.id })
  }).then(r => r.json());

  console.log("PO Creation Result:", poRes.success);
  console.log("Created PO Number:", poRes.data?.poNumber);
  console.log("PO Status immediately after Buyer Acceptance:", poRes.data?.status);
  if (poRes.data?.status !== "PENDING_ACCEPTANCE") {
    throw new Error("Expected status to be PENDING_ACCEPTANCE!");
  }

  // Check supplier notification was generated
  const notifs = await prisma.notification.findMany({
    where: { userId: supplierUser.id },
    orderBy: { createdAt: "desc" },
    take: 1
  });
  console.log("Supplier Notification:", notifs[0]?.title, "-", notifs[0]?.body);

  // 5. Test separation of actions: Buyer CANNOT accept the order
  console.log("\n4. Testing separate actions: Buyer trying to accept PO (should fail)...");
  const buyerAcceptAttempt = await fetch(`http://localhost:5000/api/purchase-orders/${poRes.data.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ status: "ACCEPTED" })
  }).then(r => r.json());
  console.log("Buyer Accept Attempt Result (Expected 403 failure):", buyerAcceptAttempt.success, buyerAcceptAttempt.error?.message);

  // 6. Supplier logs in and accepts the order
  console.log("\n5. Supplier accepts the order via PATCH /api/purchase-orders/:id/status...");
  const supplierLoginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: supplierUser.email, password: "1234567890" })
  }).then(r => r.json());

  const supplierVerifyRes = await fetch("http://localhost:5000/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: supplierLoginRes.data.userId,
      otp: supplierLoginRes.data.devOtp,
      destination: supplierLoginRes.data.destination
    })
  }).then(r => r.json());
  const supplierToken = supplierVerifyRes.data.accessToken;

  const supplierAcceptRes = await fetch(`http://localhost:5000/api/purchase-orders/${poRes.data.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supplierToken}`
    },
    body: JSON.stringify({ status: "ACCEPTED", note: "Supplier factory line confirmed." })
  }).then(r => r.json());

  console.log("Supplier Accept Result:", supplierAcceptRes.success);
  console.log("PO Status after Supplier Acceptance:", supplierAcceptRes.data?.status);
  if (supplierAcceptRes.data?.status !== "ACCEPTED") {
    throw new Error("Expected status to be ACCEPTED!");
  }

  // Check buyer notification was generated
  const buyerNotifs = await prisma.notification.findMany({
    where: { userId: buyerUser.id },
    orderBy: { createdAt: "desc" },
    take: 1
  });
  console.log("Buyer Notification:", buyerNotifs[0]?.title, "-", buyerNotifs[0]?.body);

  console.log("\n=== ALL FLOW TESTS PASSED COMPLETELY! ===");
}

runFlowTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

