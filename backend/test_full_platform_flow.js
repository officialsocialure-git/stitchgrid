const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_ACCESS_SECRET = "e7b9c6f2a8d4e1f0c5b3a7d9e2f4a6b8c0d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9";
const BASE_URL = "http://localhost:5000/api";

function createToken(userId, organizationId, role) {
  return jwt.sign({ userId, organizationId, role }, JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

async function apiCall(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, data: json };
}

async function runTest() {
  console.log("=== STARTING COMPLETE BUYER & SUPPLIER FLOW VERIFICATION ===");

  // 1. Identify Buyer and Supplier in DB
  const buyerUser = await prisma.user.findFirst({
    where: { email: "sumit@gmail.com" },
    include: { memberships: { include: { organization: true } } }
  });
  const supplierUser = await prisma.user.findFirst({
    where: { email: "suresh@northstarapparel.in" },
    include: { memberships: { include: { organization: true } } }
  });

  if (!buyerUser || !supplierUser) {
    throw new Error("Could not find buyer or supplier user in database");
  }

  const buyerMember = buyerUser.memberships[0];
  const supplierMember = supplierUser.memberships[0];

  const buyerToken = createToken(buyerUser.id, buyerMember.organizationId, buyerMember.role);
  const supplierToken = createToken(supplierUser.id, supplierMember.organizationId, supplierMember.role);

  console.log(`[1] Auth Tokens Created:`);
  console.log(`  - Buyer: ${buyerUser.fullName} (${buyerMember.organization.name}, ${buyerMember.role})`);
  console.log(`  - Supplier: ${supplierUser.fullName} (${supplierMember.organization.name}, ${supplierMember.role})`);

  // 2. Test Supplier Search & Filter Endpoints
  console.log("\n[2] Testing Supplier Discovery & Filters (Dashboard Marketplace):");

  const allSuppliers = await apiCall("/suppliers", "GET", null, buyerToken);
  console.log(`  - All Suppliers: ${allSuppliers.data.data.length} found (Status: ${allSuppliers.status})`);
  if (allSuppliers.data.data.length < 4) throw new Error("Expected at least 4 seeded suppliers");

  const garmentSuppliers = await apiCall("/suppliers?category=Garment", "GET", null, buyerToken);
  console.log(`  - Filter 'Garment': ${garmentSuppliers.data.data.length} found -> ${garmentSuppliers.data.data.map(s => s.organization.name).join(", ")}`);

  const fabricSuppliers = await apiCall("/suppliers?category=Fabric", "GET", null, buyerToken);
  console.log(`  - Filter 'Fabric': ${fabricSuppliers.data.data.length} found -> ${fabricSuppliers.data.data.map(s => s.organization.name).join(", ")}`);

  const trimsSuppliers = await apiCall("/suppliers?category=Trims", "GET", null, buyerToken);
  console.log(`  - Filter 'Trims': ${trimsSuppliers.data.data.length} found -> ${trimsSuppliers.data.data.map(s => s.organization.name).join(", ")}`);

  const jobWorkSuppliers = await apiCall("/suppliers?category=Job%20work", "GET", null, buyerToken);
  console.log(`  - Filter 'Job work': ${jobWorkSuppliers.data.data.length} found -> ${jobWorkSuppliers.data.data.map(s => s.organization.name).join(", ")}`);

  const searchSurat = await apiCall("/suppliers?q=Surat", "GET", null, buyerToken);
  console.log(`  - Search 'Surat': ${searchSurat.data.data.length} found -> ${searchSurat.data.data.map(s => s.organization.name).join(", ")}`);

  // 3. Buyer Creates an RFQ
  console.log("\n[3] Buyer Creating New RFQ:");
  const rfqPayload = {
    buyerOrgId: buyerMember.organizationId,
    title: "E2E Test Heavyweight Blank Hoodies 400 GSM",
    description: "French terry oversized drop shoulder hoodies with double lined hood",
    garmentType: "Garment",
    fabricSpec: "100% Cotton French Terry 400 GSM",
    targetPrice: 650,
    targetQuantity: 500,
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      {
        name: "Garment - E2E Test Heavyweight Blank Hoodies 400 GSM",
        description: "Black, Olive, Grey mélange colorways",
        quantity: 500,
        unit: "pieces"
      }
    ]
  };

  const rfqRes = await apiCall("/rfqs", "POST", rfqPayload, buyerToken);
  console.log(`  - RFQ Created Status: ${rfqRes.status}`);
  if (!rfqRes.data.success) {
    console.error("RFQ Error:", rfqRes.data);
    throw new Error("Failed to create RFQ");
  }
  const createdRfq = rfqRes.data.data;
  console.log(`  - RFQ ID: ${createdRfq.id}, Title: "${createdRfq.title}"`);

  // 4. Supplier Views RFQ & Submits Quotation
  console.log("\n[4] Supplier Viewing RFQ & Submitting Quotation:");
  const supplierRfqs = await apiCall("/rfqs", "GET", null, supplierToken);
  const foundRfq = supplierRfqs.data.data.find(r => r.id === createdRfq.id);
  console.log(`  - Supplier saw open RFQ in desk: ${!!foundRfq}`);

  const quotePayload = {
    rfqId: createdRfq.id,
    supplierOrgId: supplierMember.organizationId,
    totalAmount: 310000, // 500 * ₹620
    currency: "INR",
    leadTimeDays: 20,
    sampleCost: 1500,
    sampleLeadDays: 5,
    moq: 300,
    terms: "30% advance escrow, 70% post-AQL 2.5 final inspection",
    items: [
      {
        description: "Heavyweight French Terry Hoodies (Cut, Sew, Bio-wash)",
        quantity: 500,
        unitPrice: 620,
        rfqItemId: createdRfq.items[0]?.id
      }
    ]
  };

  const quoteRes = await apiCall("/quotations", "POST", quotePayload, supplierToken);
  console.log(`  - Quote Submission Status: ${quoteRes.status}`);
  if (!quoteRes.data.success) {
    console.error("Quote Error:", quoteRes.data);
    throw new Error("Failed to submit quotation");
  }
  const createdQuote = quoteRes.data.data;
  console.log(`  - Quote ID: ${createdQuote.id}, Amount: ₹${createdQuote.totalAmount}, Lead Time: ${createdQuote.leadTimeDays}d`);

  // 5. Buyer Reviews Quotations & Accepts Quote (Creates PO)
  console.log("\n[5] Buyer Reviewing Quotes & Accepting Quote (Creating PO):");
  const buyerRfqDetails = await apiCall(`/rfqs/${createdRfq.id}`, "GET", null, buyerToken);
  console.log(`  - Buyer saw ${buyerRfqDetails.data.data.quotations?.length} quotations for RFQ`);

  const poPayload = {
    quotationId: createdQuote.id,
    expectedDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
  };

  const poRes = await apiCall("/purchase-orders", "POST", poPayload, buyerToken);
  console.log(`  - PO Created Status: ${poRes.status}`);
  if (!poRes.data.success) {
    console.error("PO Error:", poRes.data);
    throw new Error("Failed to create Purchase Order");
  }
  const createdPo = poRes.data.data;
  console.log(`  - PO ID: ${createdPo.id}, PO Number: ${createdPo.poNumber}, Status: ${createdPo.status}`);
  if (createdPo.status !== "PENDING_ACCEPTANCE") {
    throw new Error(`Expected PO status to be PENDING_ACCEPTANCE, got ${createdPo.status}`);
  }

  // 6. Supplier Reviews PO & Accepts Order
  console.log("\n[6] Supplier Reviews PO & Accepts Order:");
  const supplierOrders = await apiCall("/purchase-orders", "GET", null, supplierToken);
  const foundOrder = supplierOrders.data.data.find(o => o.id === createdPo.id);
  console.log(`  - Supplier saw pending PO: ${!!foundOrder}, status: ${foundOrder?.status}`);

  const acceptOrderRes = await apiCall(`/purchase-orders/${createdPo.id}/status`, "PATCH", {
    status: "ACCEPTED",
    note: "Order confirmed by Northstar Apparel Works. Production scheduled for Loom Bay 4."
  }, supplierToken);

  console.log(`  - Supplier Accept Order Status: ${acceptOrderRes.status}`);
  if (!acceptOrderRes.data.success) {
    console.error("Accept Order Error:", acceptOrderRes.data);
    throw new Error("Failed to accept order");
  }
  const acceptedPo = acceptOrderRes.data.data;
  console.log(`  - Updated Order Status: ${acceptedPo.status}`);
  if (acceptedPo.status !== "ACCEPTED") {
    throw new Error(`Expected PO status to be ACCEPTED, got ${acceptedPo.status}`);
  }

  console.log("\n=== ALL E2E FLOW CHECKS PASSED WITH 100% REAL DATABASE DATA! ===");
}

runTest()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

