import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError, sendOk } from "../utils/http";
import { issueOtp, invalidateOtp, verifyOtp } from "../services/otp";
import { assertOtpDeliveryConfigured, sendEmailOtp, sendSmsOtp } from "../services/messaging";
import { audit } from "../services/audit";

const signupSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(6).max(25).optional().or(z.literal("")),
  password: z.string().min(10).max(128),
  organizationName: z.string().min(2).max(150),
  accountType: z.enum(["BUYER", "SUPPLIER", "BOTH"]),
  legalName: z.string().max(150).optional().or(z.literal("")),
  businessType: z.string().max(80).optional().or(z.literal("")),
  taxId: z.string().max(30).optional().or(z.literal("")),
  gstNumber: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  factoryLocation: z.string().max(100).optional().or(z.literal("")),
  serviceableRegions: z.string().max(150).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  yearsInBusiness: z.coerce.number().int().min(0).max(200).optional(),
  establishmentYear: z.coerce.number().int().min(1900).max(2100).optional(),
  productionCapacity: z.coerce.number().int().min(0).optional(),
  monthlyCapacity: z.union([z.string(), z.number()]).optional(),
  moq: z.union([z.string(), z.number()]).optional(),
  categories: z.array(z.string().min(1).max(60)).max(30).optional(),
  capabilities: z.array(z.string().min(1).max(60)).max(30).optional(),
  keyProcesses: z.array(z.string().min(1).max(60)).max(30).optional(),
}).refine(v => !!(v.email && v.email.trim()) || !!(v.phone && v.phone.trim()), "Email or phone is required");

const identifierSchema = z.object({ identifier: z.string().min(3), password: z.string().min(1) });
function issueAccessToken(userId: string, organizationId?: string, role?: string) {
  return jwt.sign({ userId, organizationId, role }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] });
}
function channel(identifier: string) { return identifier.includes("@") ? "email" : "phone"; }

export async function signup(req: Request, res: Response, next: NextFunction) {
  let createdUserId: string | null = null;
  let createdOrgId: string | null = null;
  let destination = "";

  try {
    const input = signupSchema.parse(req.body);
    const normalizedEmail = input.email && input.email.trim() ? input.email.trim().toLowerCase() : undefined;
    const rawPhone = input.phone && input.phone.trim() ? input.phone.trim().replace(/\s+/g, "") : undefined;
    assertOtpDeliveryConfigured(normalizedEmail ? "email" : "sms");
    destination = (normalizedEmail ?? rawPhone)!;

    // 1. Check for existing account
    let existingUser: any = null;
    if (normalizedEmail) {
      existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { memberships: true },
      });
    }

    if (!existingUser && rawPhone) {
      const digitsOnly = rawPhone.replace(/\D/g, "");
      const phoneVariants = Array.from(new Set([
        rawPhone,
        digitsOnly,
        digitsOnly.startsWith("91") && digitsOnly.length === 12 ? digitsOnly.slice(2) : null,
        digitsOnly.length === 10 ? `+91${digitsOnly}` : null,
        digitsOnly.length === 10 ? digitsOnly : null,
        `+${digitsOnly}`
      ].filter(Boolean) as string[]));

      existingUser = await prisma.user.findFirst({
        where: { OR: phoneVariants.map(p => ({ phone: p })) },
        include: { memberships: true },
      });
    }

    if (existingUser) {
      // If user has already verified their email or phone, prevent duplicate signup
      if (existingUser.emailVerified || existingUser.phoneVerified) {
        throw new AppError(409, "This account is already registered. Please sign in instead.", "ACCOUNT_ALREADY_REGISTERED");
      }

      // If user exists but is UNVERIFIED (e.g. prior signup failed during OTP delivery):
      // Clean up the incomplete unverified account so this fresh signup succeeds cleanly!
      console.warn(`[SIGNUP] Found incomplete unverified user ${existingUser.id} for ${destination}. Cleaning up prior draft.`);
      try {
        for (const m of existingUser.memberships || []) {
          const memberCount = await prisma.organizationMember.count({
            where: { organizationId: m.organizationId },
          });
          if (memberCount <= 1) {
            await prisma.supplierProfile.deleteMany({ where: { organizationId: m.organizationId } }).catch(() => {});
            await prisma.organizationMember.deleteMany({ where: { organizationId: m.organizationId } }).catch(() => {});
            await prisma.organization.delete({ where: { id: m.organizationId } }).catch(() => {});
          }
        }
        await prisma.organizationMember.deleteMany({ where: { userId: existingUser.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
      } catch (cleanupErr) {
        console.warn("[SIGNUP DRAFT CLEANUP WARNING]", cleanupErr);
      }
    }
    
    // 2. Create the User record
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        phone: rawPhone,
        passwordHash: await bcrypt.hash(input.password, 12),
        emailVerified: false,
        phoneVerified: false,
        isActive: true,
      },
    });
    createdUserId = user.id;

    // 3. Create Organization & Memberships
    const taxId = input.gstNumber || input.taxId || undefined;
    const city = input.factoryLocation || input.city || undefined;
    const address = input.serviceableRegions || input.address || undefined;
    
    const organization = await prisma.organization.create({
      data: {
        name: input.organizationName,
        legalName: input.legalName || undefined,
        businessType: input.businessType || undefined,
        taxId,
        address,
        city,
        country: input.country || "India",
      },
    });
    createdOrgId = organization.id;

    const roles = input.accountType === "BOTH" ? ["BUYER", "SUPPLIER"] : [input.accountType];
    await prisma.organizationMember.createMany({
      data: roles.map(role => ({
        userId: user.id,
        organizationId: organization.id,
        role: role as "BUYER" | "SUPPLIER",
      })),
    });
    
    if (roles.includes("SUPPLIER")) {
      const allCategories = Array.from(new Set([
        ...(input.categories || []),
        ...(input.capabilities || [])
      ])).filter(Boolean);

      const parsedCapacity = input.monthlyCapacity
        ? parseInt(String(input.monthlyCapacity).replace(/\D/g, ""), 10) || input.productionCapacity
        : input.productionCapacity;

      const currentYear = new Date().getFullYear();
      const calculatedYears = input.establishmentYear
        ? Math.max(0, currentYear - input.establishmentYear)
        : input.yearsInBusiness;

      const descDetails = [
        input.description,
        input.keyProcesses?.length ? `Key Operations: ${input.keyProcesses.join(", ")}` : null,
        input.moq ? `MOQ: ${input.moq}` : null,
        input.serviceableRegions ? `Regions: ${input.serviceableRegions}` : null,
        input.establishmentYear ? `Est. ${input.establishmentYear}` : null,
      ].filter(Boolean).join(" | ");

      await prisma.supplierProfile.create({
        data: {
          organizationId: organization.id,
          description: descDetails || undefined,
          yearsInBusiness: calculatedYears,
          productionCapacity: parsedCapacity,
          categories: allCategories.length ? { create: allCategories.map(category => ({ category })) } : undefined,
        },
      });
    }

    // 4. Issue and deliver OTP
    const otpRes = await issueOtp(destination, { allowExisting: true });
    let deliveryResult: any = null;

    if (!otpRes.isExisting && otpRes.otp) {
      try {
        if (normalizedEmail) {
          deliveryResult = await sendEmailOtp(normalizedEmail, otpRes.otp);
        } else {
          deliveryResult = await sendSmsOtp(rawPhone!, otpRes.otp);
        }
      } catch (deliveryError) {
        await invalidateOtp(destination);

        // ATOMIC ROLLBACK: Purge unverified user & organization so database is never left in an incomplete state
        console.error(`[SIGNUP ERROR] OTP delivery failed for ${destination}. Rolling back created account records.`);
        try {
          if (createdOrgId) {
            await prisma.supplierProfile.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
            await prisma.organizationMember.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
            await prisma.organization.delete({ where: { id: createdOrgId } }).catch(() => {});
          }
          if (createdUserId) {
            await prisma.organizationMember.deleteMany({ where: { userId: createdUserId } }).catch(() => {});
            await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
          }
        } catch (rollbackErr) {
          console.error("[SIGNUP ROLLBACK CLEANUP ERROR]", rollbackErr);
        }

        throw deliveryError;
      }
    }

    await audit("AUTH_SIGNUP", "User", user.id, user.id, organization.id);
    return sendOk(res, {
      userId: user.id,
      organizationId: organization.id,
      verificationChannel: normalizedEmail ? "email" : "sms",
      destination,
      message: deliveryResult?.devOtp
        ? `Account created. (Testing mode: OTP is ${deliveryResult.devOtp})`
        : "Account created. Verify the OTP to continue.",
      cooldownRemaining: otpRes.cooldownRemaining,
      ...(deliveryResult?.devOtp ? { devOtp: deliveryResult.devOtp } : {}),
      ...(deliveryResult?.sandboxNotice ? { sandboxNotice: deliveryResult.sandboxNotice } : {}),
    }, 201);
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = identifierSchema.parse(req.body);
    const trimmed = input.identifier.trim();
    const isEmail = channel(trimmed) === "email";

    let user;
    if (isEmail) {
      user = await prisma.user.findFirst({
        where: { email: trimmed.toLowerCase() }
      });
    } else {
      const cleanPhone = trimmed.replace(/\s+/g, "");
      const digitsOnly = cleanPhone.replace(/\D/g, "");
      const phoneVariants = Array.from(new Set([
        cleanPhone,
        digitsOnly,
        digitsOnly.startsWith("91") && digitsOnly.length === 12 ? digitsOnly.slice(2) : null,
        digitsOnly.length === 10 ? `+91${digitsOnly}` : null,
        digitsOnly.length === 10 ? digitsOnly : null,
        `+${digitsOnly}`
      ].filter(Boolean) as string[]));

      user = await prisma.user.findFirst({
        where: {
          OR: phoneVariants.map(p => ({ phone: p }))
        }
      });
    }

    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const destination = isEmail ? user.email : user.phone;
    if (!destination) throw new AppError(400, "This login channel is not registered");
    assertOtpDeliveryConfigured(isEmail ? "email" : "sms");
    const otpRes = await issueOtp(destination, { allowExisting: true });
    let deliveryResult: any = null;
    if (!otpRes.isExisting && otpRes.otp) {
      try {
        if (isEmail) deliveryResult = await sendEmailOtp(destination, otpRes.otp);
        else deliveryResult = await sendSmsOtp(destination, otpRes.otp);
      } catch (error) {
        await invalidateOtp(destination);
        throw error;
      }
    }
    return sendOk(res, {
      challengeId: user.id,
      userId: user.id,
      destination,
      verificationChannel: isEmail ? "email" : "sms",
      message: otpRes.isExisting
        ? "Verification code already active. Enter code to continue."
        : deliveryResult?.devOtp
        ? `OTP sent. (Testing mode: OTP is ${deliveryResult.devOtp})`
        : "OTP sent. Verify to complete login.",
      cooldownRemaining: otpRes.cooldownRemaining,
      ...(deliveryResult?.devOtp ? { devOtp: deliveryResult.devOtp } : {}),
      ...(deliveryResult?.sandboxNotice ? { sandboxNotice: deliveryResult.sandboxNotice } : {}),
    });
  } catch (e) { next(e); }
}

export async function verifyLoginOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      userId: z.string(),
      destination: z.string().min(3).optional(),
      otp: z.string().length(6),
      organizationId: z.string().optional(),
      role: z.enum(["BUYER", "SUPPLIER", "ADMIN"]).optional()
    }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            organization: {
              include: {
                supplierProfile: true
              }
            }
          }
        }
      }
    });
    if (!user || !user.isActive) throw new AppError(401, "Invalid login challenge");
    const registeredDestinations = [user.email, user.phone].filter((value): value is string => Boolean(value));
    const requestedDestination = input.destination?.trim();
    const destination = requestedDestination
      ? registeredDestinations.find(value => value.toLowerCase() === requestedDestination.toLowerCase())
      : (user.email ?? user.phone);
    if (!destination) throw new AppError(403, "OTP destination does not belong to this account", "OTP_DESTINATION_MISMATCH");
    await verifyOtp(destination, input.otp);

    const isEmail = destination.includes("@");
    await prisma.user.update({
      where: { id: user.id },
      data: isEmail ? { emailVerified: true } : { phoneVerified: true }
    });

    let membership = user.memberships.find(m => (!input.organizationId || m.organizationId === input.organizationId) && (!input.role || m.role === input.role));
    if (!membership && user.memberships.length > 0) {
      membership = user.memberships[0];
    }
    const accessToken = issueAccessToken(user.id, membership?.organizationId, membership?.role);
    await audit("AUTH_LOGIN", "User", user.id, user.id, membership?.organizationId);
    return sendOk(res, {
      accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
      activeMembership: membership ? { organizationId: membership.organizationId, role: membership.role, organization: membership.organization } : null,
      memberships: user.memberships.map((m: any) => ({ organizationId: m.organizationId, role: m.role, organization: m.organization }))
    });
  } catch (e) { next(e); }
}

export async function switchContext(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string(),
      role: z.enum(["BUYER", "SUPPLIER", "ADMIN"])
    }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.auth!.userId,
        organizationId: input.organizationId,
        role: input.role,
        isActive: true
      },
      include: { organization: true }
    });
    if (!membership) throw new AppError(403, "No active membership found for requested organization and role");
    const accessToken = issueAccessToken(req.auth!.userId, membership.organizationId, membership.role);
    await audit("AUTH_SWITCH_CONTEXT", "User", req.auth!.userId, req.auth!.userId, membership.organizationId, { role: membership.role });
    return sendOk(res, {
      accessToken,
      activeMembership: {
        organizationId: membership.organizationId,
        role: membership.role,
        organization: membership.organization
      }
    });
  } catch (e) { next(e); }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ destination: z.string().min(3) }).parse(req.body);
    const otpChannel = channel(input.destination) === "email" ? "email" : "sms";
    assertOtpDeliveryConfigured(otpChannel);
    const otpRes = await issueOtp(input.destination, { allowExisting: false });
    let deliveryResult: any = null;
    try {
      if (otpChannel === "email") deliveryResult = await sendEmailOtp(input.destination, otpRes.otp);
      else deliveryResult = await sendSmsOtp(input.destination, otpRes.otp);
    } catch (error) {
      await invalidateOtp(input.destination);
      throw error;
    }
    return sendOk(res, {
      message: deliveryResult?.devOtp
        ? `A new verification code has been sent. (Testing mode: OTP is ${deliveryResult.devOtp})`
        : "A new 6-digit verification code has been sent.",
      cooldownRemaining: otpRes.cooldownRemaining,
      ...(deliveryResult?.devOtp ? { devOtp: deliveryResult.devOtp } : {}),
      ...(deliveryResult?.sandboxNotice ? { sandboxNotice: deliveryResult.sandboxNotice } : {}),
    });
  } catch (e) { next(e); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { memberships: { include: { organization: true } } } });
    if (!user) throw new AppError(404, "User not found");
    const activeMembership = user.memberships.find(m => m.organizationId === req.auth?.organizationId && m.role === req.auth?.role) || (user.memberships.length > 0 ? user.memberships[0] : null);
    return sendOk(res, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      activeMembership,
      memberships: user.memberships
    });
  } catch (e) { next(e); }
}

export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { credential } = z.object({ credential: z.string().min(20) }).parse(req.body);
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError(503, "Google sign-in is not configured. Please contact the administrator.", "GOOGLE_NOT_CONFIGURED");
    }

    // Verify the Google ID token with Google's token-info endpoint; never trust a client-supplied email.
    const verificationResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!verificationResponse.ok) {
      throw new AppError(401, "Google sign-in could not be verified. Please try again.", "GOOGLE_AUTH_FAILED");
    }

    const profile = await verificationResponse.json() as {
      aud?: string; iss?: string; exp?: string; email?: string; email_verified?: string;
      name?: string; sub?: string;
    };
    const validIssuer = profile.iss === "accounts.google.com" || profile.iss === "https://accounts.google.com";
    const expiresAt = Number(profile.exp || 0);
    if (
      profile.aud !== env.GOOGLE_CLIENT_ID ||
      !validIssuer ||
      !profile.sub ||
      !profile.email ||
      profile.email_verified !== "true" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new AppError(401, "Google account verification failed. Use a verified Google account.", "GOOGLE_AUTH_FAILED");
    }

    const email = profile.email.trim().toLowerCase();
    const fullName = (profile.name || email.split("@")[0] || "User").trim().slice(0, 100);
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: { organization: { include: { supplierProfile: true } } }
        }
      }
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(`${randomUUID()}${randomUUID()}`, 12);
      user = await prisma.user.create({
        data: { fullName, email, passwordHash: randomPassword, emailVerified: true, isActive: true },
        include: {
          memberships: {
            where: { isActive: true },
            include: { organization: { include: { supplierProfile: true } } }
          }
        }
      });
    } else {
      if (!user.isActive) {
        throw new AppError(403, "This account is inactive. Please contact STITCHGRID support.", "ACCOUNT_INACTIVE");
      }
      if (!user.emailVerified) {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      }
    }

    const membership = user.memberships[0] || null;
    const accessToken = issueAccessToken(user.id, membership?.organizationId, membership?.role);
    await audit("AUTH_LOGIN_GOOGLE", "User", user.id, user.id, membership?.organizationId);

    return sendOk(res, {
      accessToken,
      requiresOnboarding: !membership,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
      activeMembership: membership ? { organizationId: membership.organizationId, role: membership.role, organization: membership.organization } : null,
      memberships: user.memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, organization: m.organization }))
    });
  } catch (e) {
    next(e);
  }
}

export async function completeGoogleOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationName: z.string().trim().min(2).max(150),
      accountType: z.enum(["BUYER", "SUPPLIER"]),
      legalName: z.string().trim().max(150).optional(),
      businessType: z.string().trim().max(80).optional(),
      taxId: z.string().trim().max(30).optional(),
      address: z.string().trim().max(300).optional(),
      city: z.string().trim().max(100).optional(),
      country: z.string().trim().max(80).default("India"),
      description: z.string().trim().max(2000).optional(),
      yearsInBusiness: z.coerce.number().int().min(0).max(200).optional(),
      productionCapacity: z.coerce.number().int().min(0).optional(),
      categories: z.array(z.string().trim().min(1).max(60)).max(30).optional()
    }).parse(req.body);

    const userId = req.auth!.userId;
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId, isActive: true }
    });
    if (existingMembership) {
      throw new AppError(409, "Your organization is already set up. Please continue to your dashboard.", "ONBOARDING_ALREADY_COMPLETED");
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          legalName: input.legalName || undefined,
          businessType: input.businessType || (input.accountType === "SUPPLIER" ? "Garments & Textiles" : "Brand / Buyer"),
          taxId: input.taxId || undefined,
          address: input.address || undefined,
          city: input.city || undefined,
          country: input.country
        }
      });
      const membership = await tx.organizationMember.create({
        data: { userId, organizationId: organization.id, role: input.accountType },
        include: { organization: { include: { supplierProfile: true } } }
      });
      if (input.accountType === "SUPPLIER") {
        await tx.supplierProfile.create({
          data: {
            organizationId: organization.id,
            description: input.description || undefined,
            yearsInBusiness: input.yearsInBusiness,
            productionCapacity: input.productionCapacity,
            categories: input.categories?.length
              ? { create: input.categories.map((category) => ({ category })) }
              : undefined
          }
        });
      }
      return { organization, membership };
    });

    const accessToken = issueAccessToken(userId, result.membership.organizationId, result.membership.role);
    await audit("AUTH_GOOGLE_ONBOARDING_COMPLETED", "Organization", result.organization.id, userId, result.organization.id);
    return sendOk(res, {
      accessToken,
      activeMembership: {
        organizationId: result.membership.organizationId,
        role: result.membership.role,
        organization: result.membership.organization
      }
    }, 201);
  } catch (e) {
    next(e);
  }
}
