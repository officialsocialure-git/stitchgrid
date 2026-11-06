require('dotenv').config({ path: __dirname + '/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const BASE_URL = "http://localhost:5000/api";

async function post(path, body, origin = "https://stitchgrid-three.vercel.app") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), data: json };
}

async function options(path, origin = "https://stitchgrid-three.vercel.app") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "OPTIONS",
    headers: {
      "Origin": origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type,Authorization"
    }
  });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
}

async function runTests() {
  console.log("=================================================");
  console.log("  AUTHENTICATION & SECURITY TEST SUITE");
  console.log("=================================================");

  // TEST 1: CORS Preflight OPTIONS from deployed Vercel domain
  console.log("\n[TEST 1] Testing CORS Preflight OPTIONS from https://stitchgrid-three.vercel.app:");
  const preflightRes = await options("/auth/login");
  console.log(`  -> Status: ${preflightRes.status}`);
  console.log(`  -> Access-Control-Allow-Origin: ${preflightRes.headers['access-control-allow-origin']}`);
  console.log(`  -> Access-Control-Allow-Methods: ${preflightRes.headers['access-control-allow-methods']}`);
  if (preflightRes.status !== 204 && preflightRes.status !== 200) {
    throw new Error(`CORS Preflight failed with status ${preflightRes.status}`);
  }
  if (preflightRes.headers['access-control-allow-origin'] !== "https://stitchgrid-three.vercel.app") {
    throw new Error(`CORS header mismatch: expected https://stitchgrid-three.vercel.app, got ${preflightRes.headers['access-control-allow-origin']}`);
  }
  console.log("  ✅ Test 1 Passed: CORS preflight succeeds with 204.");

  // Prepare a test user in TiDB Cloud
  const testEmail = "authtest@example.com";
  const testPassword = "SecurePassword123!";
  const passwordHash = await bcrypt.hash(testPassword, 10);

  let existingUser = await prisma.user.findFirst({ where: { email: testEmail } });
  if (!existingUser) {
    const org = await prisma.organization.create({
      data: { name: "Auth Test Enterprise", businessType: "Garments" }
    });
    existingUser = await prisma.user.create({
      data: {
        fullName: "Auth Tester",
        email: testEmail,
        passwordHash,
        emailVerified: true
      }
    });
    await prisma.organizationMember.create({
      data: { userId: existingUser.id, organizationId: org.id, role: "BUYER" }
    });
  } else {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash }
    });
  }

  // TEST 2: Existing User Login -> OTP Request
  console.log("\n[TEST 2] Existing User Login Request:");
  const login1 = await post("/auth/login", { identifier: testEmail, password: testPassword });
  console.log(`  -> Login Status: ${login1.status}`);
  console.log(`  -> Response message: ${login1.data.data?.message}`);
  console.log(`  -> Dev OTP received: ${login1.data.data?.devOtp}`);
  if (login1.status !== 200 || !login1.data.success) {
    throw new Error(`Login failed: ${JSON.stringify(login1.data)}`);
  }
  const otp1 = login1.data.data?.devOtp;
  if (!otp1) throw new Error("Expected devOtp in test response");
  console.log("  ✅ Test 2 Passed: Login accepted credentials and generated OTP.");

  // TEST 3: User Re-submits login within cooldown (the bug reported by user!)
  console.log("\n[TEST 3] User re-submits login within cooldown window (verifying no 429 lockout):");
  const login2 = await post("/auth/login", { identifier: testEmail, password: testPassword });
  console.log(`  -> Second Login Status: ${login2.status}`);
  console.log(`  -> Response message: ${login2.data.data?.message}`);
  if (login2.status !== 200 || !login2.data.success) {
    throw new Error(`Second login failed with status ${login2.status}: ${JSON.stringify(login2.data)}`);
  }
  console.log("  ✅ Test 3 Passed: User is NOT locked out; existing active OTP challenge allows proceeding to /verify-otp.");

  // TEST 4: Invalid OTP Verification
  console.log("\n[TEST 4] Submitting invalid OTP:");
  const invalidVerify = await post("/auth/verify-otp", {
    userId: existingUser.id,
    destination: testEmail,
    otp: "000000"
  });
  console.log(`  -> Status: ${invalidVerify.status}`);
  console.log(`  -> Error code: ${invalidVerify.data.error?.code}, message: ${invalidVerify.data.error?.message}`);
  if (invalidVerify.status !== 400 || invalidVerify.data.error?.code !== "OTP_INVALID") {
    throw new Error(`Expected OTP_INVALID 400, got ${invalidVerify.status}`);
  }
  console.log("  ✅ Test 4 Passed: Invalid OTP rejected safely.");

  // TEST 5: Valid OTP Verification
  console.log("\n[TEST 5] Submitting valid OTP:");
  const validVerify = await post("/auth/verify-otp", {
    userId: existingUser.id,
    destination: testEmail,
    otp: otp1
  });
  console.log(`  -> Status: ${validVerify.status}`);
  console.log(`  -> Access Token generated: ${!!validVerify.data.data?.accessToken}`);
  console.log(`  -> User info: ${validVerify.data.data?.user?.fullName} (${validVerify.data.data?.user?.email})`);
  if (validVerify.status !== 200 || !validVerify.data.data?.accessToken) {
    throw new Error(`Valid OTP verification failed: ${JSON.stringify(validVerify.data)}`);
  }
  console.log("  ✅ Test 5 Passed: User successfully authenticated with JWT session.");

  // TEST 6: Resend OTP Cooldown Verification
  console.log("\n[TEST 6] Testing Resend OTP & Cooldown Enforcement:");
  const resend1 = await post("/auth/resend-otp", { destination: testEmail });
  console.log(`  -> Resend 1 Status: ${resend1.status}`);
  if (resend1.status !== 200) {
    throw new Error(`Resend 1 failed: ${JSON.stringify(resend1.data)}`);
  }
  // Immediate second resend should hit cooldown
  const resend2 = await post("/auth/resend-otp", { destination: testEmail });
  console.log(`  -> Resend 2 (immediate) Status: ${resend2.status}`);
  console.log(`  -> Error message: ${resend2.data.error?.message}`);
  if (resend2.status !== 429 || resend2.data.error?.code !== "OTP_COOLDOWN") {
    throw new Error(`Expected OTP_COOLDOWN 429, got ${resend2.status}`);
  }
  console.log("  ✅ Test 6 Passed: Resend cooldown correctly enforced against spam.");

  // TEST 7: Signup Flow
  console.log("\n[TEST 7] Testing New User Registration Flow:");
  const uniqueId = Date.now().toString().slice(-6);
  const signupPayload = {
    fullName: `Test Buyer ${uniqueId}`,
    email: `buyer_${uniqueId}@stitchgridtest.in`,
    password: "SecureSignupPassword123!",
    organizationName: `Buyer Enterprise ${uniqueId}`,
    accountType: "BUYER"
  };
  const signupRes = await post("/auth/signup", signupPayload);
  console.log(`  -> Signup Status: ${signupRes.status}`);
  console.log(`  -> Dev OTP: ${signupRes.data.data?.devOtp}`);
  if (signupRes.status !== 201 || !signupRes.data.data?.devOtp) {
    throw new Error(`Signup failed: ${JSON.stringify(signupRes.data)}`);
  }

  // Verify signup OTP
  const signupVerify = await post("/auth/verify-otp", {
    userId: signupRes.data.data.userId,
    destination: signupPayload.email,
    otp: signupRes.data.data.devOtp
  });
  console.log(`  -> Signup Verification Status: ${signupVerify.status}`);
  console.log(`  -> Signup Token issued: ${!!signupVerify.data.data?.accessToken}`);
  if (signupVerify.status !== 200 || !signupVerify.data.data?.accessToken) {
    throw new Error(`Signup verification failed: ${JSON.stringify(signupVerify.data)}`);
  }
  console.log("  ✅ Test 7 Passed: Signup + OTP verification works end-to-end.");

  console.log("\n=================================================");
  console.log("  🎉 ALL 7 AUTHENTICATION & SECURITY TESTS PASSED!");
  console.log("=================================================");
}

runTests()
  .catch(err => {
    console.error("\n❌ TEST SUITE FAILURE:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
