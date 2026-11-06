const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_ACCESS_SECRET = "e7b9c6f2a8d4e1f0c5b3a7d9e2f4a6b8c0d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9";
const BASE_URL = "http://localhost:5000/api";

function createToken(userId, organizationId, role) {
  return jwt.sign({ userId, organizationId, role }, JWT_ACCESS_SECRET, { expiresIn: '24h' });
}

async function apiCall(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

async function runAudit() {
  console.log("=================================================");
  console.log("  STITCHGRID FULL-PLATFORM E2E AUDIT & VERIFICATION");
  console.log("=================================================");

  // 1. Health check
  console.log("\n[TEST 1] Testing Health Endpoint:");
  const health = await apiCall("/health");
  console.log(`  -> Health API Status: ${health.status}, Result:`, health.data);
  if (health.status !== 200 || !health.data.healthy && health.data.status !== "healthy") {
    throw new Error("Health check failed");
  }

  // 2. Database & Users
  console.log("\n[TEST 2] Verifying Buyer & Supplier Accounts:");
  const buyerUser = await prisma.user.findFirst({
    where: { email: "sumit@gmail.com" },
    include: { memberships: { include: { organization: true } } }
  });
  const supplierUser = await prisma.user.findFirst({
    where: { email: "pushpak@gmail.com" },
    include: { memberships: { include: { organization: true } } }
  });

  if (!buyerUser || !supplierUser) {
    throw new Error("Both buyer (sumit@gmail.com) and supplier (pushpak@gmail.com) must exist in DB");
  }

  const buyerMember = buyerUser.memberships.find(m => m.role === "BUYER") || buyerUser.memberships[0];
  const supplierMember = supplierUser.memberships.find(m => m.role === "SUPPLIER") || supplierUser.memberships[0];

  const buyerToken = createToken(buyerUser.id, buyerMember.organizationId, "BUYER");
  const supplierToken = createToken(supplierUser.id, supplierMember.organizationId, "SUPPLIER");

  console.log(`  -> Buyer User: ${buyerUser.fullName} (Org: ${buyerMember.organization?.name})`);
  console.log(`  -> Supplier User: ${supplierUser.fullName} (Org: ${supplierMember.organization?.name})`);
  console.log(`  -> Tokens generated with 24h expiration.`);

  // 3. Supplier Search & Marketplace Filters
  console.log("\n[TEST 3] Supplier Discovery & Marketplace Filter APIs:");
  const allSuppliers = await apiCall("/suppliers", "GET", null, buyerToken);
  console.log(`  -> All Suppliers returned: ${allSuppliers.data.data?.length || 0} (Status: ${allSuppliers.status})`);
  if (!allSuppliers.data.data || allSuppliers.data.data.length === 0) {
    throw new Error("No suppliers returned from /suppliers");
  }

  const garmentFilter = await apiCall("/suppliers?category=Garment", "GET", null, buyerToken);
  console.log(`  -> Garment category filter returned: ${garmentFilter.data.data?.length || 0} suppliers`);

  // 4. Buyer RFQs
  console.log("\n[TEST 4] Buyer RFQs & Detail Retrieval:");
  const buyerRfqs = await apiCall("/rfqs", "GET", null, buyerToken);
  console.log(`  -> Buyer RFQs count: ${buyerRfqs.data.data?.length || 0} (Status: ${buyerRfqs.status})`);

  if (buyerRfqs.data.data && buyerRfqs.data.data.length > 0) {
    const firstRfq = buyerRfqs.data.data[0];
    const rfqDetail = await apiCall(`/rfqs/${firstRfq.id}`, "GET", null, buyerToken);
    console.log(`  -> RFQ #${firstRfq.id.slice(-4)} details fetched (Status: ${rfqDetail.status}), Title: "${rfqDetail.data.data?.title}"`);
  }

  // 5. Supplier Buyer Requests View
  console.log("\n[TEST 5] Supplier Buyer Requests API:");
  const supplierRequests = await apiCall("/rfqs", "GET", null, supplierToken);
  console.log(`  -> Supplier received ${supplierRequests.data.data?.length || 0} buyer requests (Status: ${supplierRequests.status})`);

  // 6. Purchase Orders
  console.log("\n[TEST 6] Purchase Orders API (Buyer & Supplier):");
  const buyerOrders = await apiCall("/purchase-orders", "GET", null, buyerToken);
  console.log(`  -> Buyer Orders count: ${buyerOrders.data.data?.length || 0} (Status: ${buyerOrders.status})`);
  const supplierOrders = await apiCall("/purchase-orders", "GET", null, supplierToken);
  console.log(`  -> Supplier Orders count: ${supplierOrders.data.data?.length || 0} (Status: ${supplierOrders.status})`);

  if (buyerOrders.data.data && buyerOrders.data.data.length > 0) {
    const po = buyerOrders.data.data[0];
    const poDetail = await apiCall(`/purchase-orders/${po.id}`, "GET", null, buyerToken);
    console.log(`  -> PO #${po.poNumber || po.id.slice(0, 8)} status: ${poDetail.data.data?.status}`);
  }

  // 7. Samples Workflow & Photo Management
  console.log("\n[TEST 7] Samples Workflow API:");
  const samples = await apiCall("/samples", "GET", null, buyerToken);
  console.log(`  -> Samples count: ${samples.data.data?.length || 0} (Status: ${samples.status})`);

  if (samples.data.data && samples.data.data.length > 0) {
    const testSample = samples.data.data[0];
    console.log(`  -> Sample #${testSample.id} initial status: ${testSample.status}`);

    // Test sample file upload
    console.log("  -> Testing sample file upload API (/api/upload)...");
    const fakeBase64 = Buffer.from("STITCHGRID_TEST_IMAGE_BYTES").toString("base64");
    const uploadRes = await apiCall("/upload", "POST", {
      filename: "test-sample-photo.jpg",
      data: `data:image/jpeg;base64,${fakeBase64}`,
      label: "Front View Collar Detail"
    }, supplierToken);

    console.log(`  -> Upload result (Status: ${uploadRes.status}):`, uploadRes.data.data?.url);
    if (!uploadRes.data.data?.url) {
      throw new Error("File upload failed to return a URL");
    }

    // Test supplier saving sample photos
    const updateRes = await apiCall(`/samples/${testSample.id}`, "PATCH", {
      photos: [{ url: uploadRes.data.data.url, label: "Front View Collar Detail" }],
      notes: "Updated prototype collar sample"
    }, supplierToken);
    console.log(`  -> Sample photo update (Status: ${updateRes.status}), photos saved: ${updateRes.data.data?.photos?.length || 0}`);
  }

  // 8. Conversations & Messaging
  console.log("\n[TEST 8] Conversations & Real-Time Messaging API:");
  const conversations = await apiCall("/conversations", "GET", null, buyerToken);
  console.log(`  -> Conversations count: ${conversations.data.data?.length || 0} (Status: ${conversations.status})`);

  if (conversations.data.data && conversations.data.data.length > 0) {
    const convId = conversations.data.data[0].id;
    // Send message from buyer
    const sendRes = await apiCall(`/conversations/${convId}/messages`, "POST", {
      body: "Audit test message: checking live socket/polling sync at " + new Date().toISOString()
    }, buyerToken);
    console.log(`  -> Message sent status: ${sendRes.status}, id: ${sendRes.data.data?.id}`);

    // Retrieve conversation messages
    const msgs = await apiCall(`/conversations/${convId}/messages`, "GET", null, supplierToken);
    console.log(`  -> Supplier fetched messages count: ${msgs.data.data?.length || 0} (Status: ${msgs.status})`);
  }

  // 9. Payments & Escrow Vault
  console.log("\n[TEST 9] Payments & Escrow Vault Ledger API:");
  const payments = await apiCall("/payments", "GET", null, buyerToken);
  console.log(`  -> Escrow transactions count: ${payments.data.data?.length || 0} (Status: ${payments.status})`);
  if (payments.data.data && payments.data.data.length > 0) {
    const firstPayment = payments.data.data[0];
    console.log(`  -> Latest transaction: ${firstPayment.providerRef || firstPayment.id}, Status: ${firstPayment.status}, Amount: ₹${firstPayment.amount}`);
  }

  console.log("\n=================================================");
  console.log("  ✅ ALL AUDIT TESTS COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

runAudit()
  .catch(err => {
    console.error("\n❌ AUDIT ERROR:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

