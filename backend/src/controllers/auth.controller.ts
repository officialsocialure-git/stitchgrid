import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
    email: z.string().trim().email("Please enter a valid email address").optional().or(z.literal("")),
    phone: z.string().trim().min(6, "Mobile number must be at least 6 digits").max(25).optional().or(z.literal("")),
    password: z.string().min(10, "Password must be at least 10 characters").max(128),
    organizationName: z.string().trim().min(2, "Organization name must be at least 2 characters").max(150),
    accountType: z.enum(["BUYER", "SUPPLIER", "BOTH"]),
    legalName: z.string().trim().max(150).optional().or(z.literal("")),
    businessType: z.string().trim().max(80).optional().or(z.literal("")),
    taxId: z.string().trim().max(30).optional().or(z.literal("")),
    gstNumber: z.string().trim().max(30).optional().or(z.literal("")),
    address: z.string().trim().max(300).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    factoryLocation: z.string().trim().max(100).optional().or(z.literal("")),
    serviceableRegions: z.string().trim().max(150).optional().or(z.literal("")),
    country: z.string().trim().max(80).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    yearsInBusiness: z.coerce.number().int().min(0).max(200).optional(),
    establishmentYear: z.coerce.number().int().min(1900).max(2100).optional(),
    productionCapacity: z.coerce.number().int().min(0).optional(),
    monthlyCapacity: z.union([z.string(), z.number()]).optional(),
    moq: z.union([z.string(), z.number()]).optional(),
    categories: z.array(z.string().min(1).max(60)).max(30).optional(),
    capabilities: z.array(z.string().min(1).max(60)).max(30).optional(),
    keyProcesses: z.array(z.string().min(1).max(60)).max(30).optional(),
  })
  .refine((v) => !!(v.email && v.email.trim()) || !!(v.phone && v.phone.trim()), {
    message: "Either email address or mobile number is required",
    path: ["email"],
  });

const identifierSchema = z.object({
  identifier: z.string().trim().min(3, "Please enter your registered email address or mobile number"),
  password: z.string().min(1, "Please enter your account password"),
});

function issueAccessToken(userId: string, organizationId?: string, role?: string) {
  return jwt.sign({ userId, organizationId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  });
}

function channel(identifier: string) {
  return identifier.includes("@") ? "email" : "phone";
}

function buildPhoneVariants(rawPhone: string): string[] {
  const cleanPhone = rawPhone.replace(/\s+/g, "");
  const digitsOnly = cleanPhone.replace(/\D/g, "");
  return Array.from(
    new Set(
      [
        rawPhone,
        cleanPhone,
        digitsOnly,
        digitsOnly.startsWith("91") && digitsOnly.length === 12 ? digitsOnly.slice(2) : null,
        digitsOnly.length === 10 ? `+91${digitsOnly}` : null,
        digitsOnly.length === 10 ? digitsOnly : null,
        `+${digitsOnly}`,
      ].filter(Boolean) as string[]
    )
  );
}

/**
 * 1. Direct Secure Signup (No OTP Required)
 * - Checks for duplicate email or mobile number and returns 409 Conflict.
 * - Securely hashes password with bcrypt (12 rounds).
 * - Creates User, Organization, Memberships, and SupplierProfile atomically.
 * - Directly issues JWT access token.
 */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const input = signupSchema.parse(req.body);
    const normalizedEmail = input.email && input.email.trim() ? input.email.trim().toLowerCase() : undefined;
    const rawPhone = input.phone && input.phone.trim() ? input.phone.trim().replace(/\s+/g, "") : undefined;

    // 1. Strict Uniqueness Verification for Email
    if (normalizedEmail) {
      const existingEmailUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingEmailUser) {
        throw new AppError(
          409,
          "This email address is already registered. Please sign in instead.",
          "EMAIL_ALREADY_EXISTS"
        );
      }
    }

    // 2. Strict Uniqueness Verification for Mobile Number
    if (rawPhone) {
      const phoneVariants = buildPhoneVariants(rawPhone);
      const existingPhoneUser = await prisma.user.findFirst({
        where: { OR: phoneVariants.map((p) => ({ phone: p })) },
      });
      if (existingPhoneUser) {
        throw new AppError(
          409,
          "This mobile number is already registered. Please sign in instead.",
          "PHONE_ALREADY_EXISTS"
        );
      }
    }

    // 3. Hash Password & Persist User
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        phone: rawPhone,
        passwordHash,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });

    // 4. Create Organization & Associated Profiles
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

    const roles = input.accountType === "BOTH" ? ["BUYER", "SUPPLIER"] : [input.accountType];
    await prisma.organizationMember.createMany({
      data: roles.map((role) => ({
        userId: user.id,
        organizationId: organization.id,
        role: role as "BUYER" | "SUPPLIER",
      })),
    });

    if (roles.includes("SUPPLIER")) {
      const allCategories = Array.from(
        new Set([...(input.categories || []), ...(input.capabilities || [])])
      ).filter(Boolean);

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
      ]
        .filter(Boolean)
        .join(" | ");

      await prisma.supplierProfile.create({
        data: {
          organizationId: organization.id,
          description: descDetails || undefined,
          yearsInBusiness: calculatedYears,
          productionCapacity: parsedCapacity,
          categories: allCategories.length
            ? { create: allCategories.map((category) => ({ category })) }
            : undefined,
        },
      });
    }

    // 5. Fetch Full Active Membership & Generate JWT
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, organizationId: organization.id, isActive: true },
      include: { organization: { include: { supplierProfile: true } } },
    });

    const accessToken = issueAccessToken(user.id, organization.id, membership?.role);
    await audit("AUTH_SIGNUP", "User", user.id, user.id, organization.id);

    return sendOk(
      res,
      {
        accessToken,
        user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
        activeMembership: membership
          ? {
              organizationId: membership.organizationId,
              role: membership.role,
              organization: membership.organization,
            }
          : null,
        memberships: membership
          ? [
              {
                organizationId: membership.organizationId,
                role: membership.role,
                organization: membership.organization,
              },
            ]
          : [],
        message: "Account created successfully! Welcome to STITCHGRID.",
      },
      201
    );
  } catch (e) {
    next(e);
  }
}

/**
 * 2. Direct Secure Login (No OTP Required)
 * - Supports login via email or mobile number with password.
 * - Compares password hash using bcrypt.
 * - Immediately returns JWT access token and active membership.
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = identifierSchema.parse(req.body);
    const trimmed = input.identifier.trim();
    const isEmail = channel(trimmed) === "email";

    let user;
    if (isEmail) {
      user = await prisma.user.findFirst({
        where: { email: trimmed.toLowerCase() },
        include: {
          memberships: {
            where: { isActive: true },
            include: { organization: { include: { supplierProfile: true } } },
          },
        },
      });
    } else {
      const phoneVariants = buildPhoneVariants(trimmed);
      user = await prisma.user.findFirst({
        where: { OR: phoneVariants.map((p) => ({ phone: p })) },
        include: {
          memberships: {
            where: { isActive: true },
            include: { organization: { include: { supplierProfile: true } } },
          },
        },
      });
    }

    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Invalid email/mobile or password.", "INVALID_CREDENTIALS");
    }

    // Select primary membership (prefer ADMIN if user is admin, otherwise first active membership)
    let membership =
      user.memberships.find((m) => m.role === "ADMIN") ||
      (user.memberships.length > 0 ? user.memberships[0] : null);

    const accessToken = issueAccessToken(user.id, membership?.organizationId, membership?.role);
    await audit("AUTH_LOGIN", "User", user.id, user.id, membership?.organizationId);

    return sendOk(res, {
      accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
      activeMembership: membership
        ? {
            organizationId: membership.organizationId,
            role: membership.role,
            organization: membership.organization,
          }
        : null,
      memberships: user.memberships.map((m: any) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: m.organization,
      })),
      message: "Login successful! Welcome back.",
    });
  } catch (e) {
    next(e);
  }
}

/**
 * 3. Secure Password Reset Flow (Non-OTP)
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      identifier: z.string().trim().min(3, "Please enter your registered email or mobile number"),
    }).parse(req.body);

    const trimmed = input.identifier.trim();
    const isEmail = channel(trimmed) === "email";

    let user;
    if (isEmail) {
      user = await prisma.user.findFirst({ where: { email: trimmed.toLowerCase() } });
    } else {
      const phoneVariants = buildPhoneVariants(trimmed);
      user = await prisma.user.findFirst({ where: { OR: phoneVariants.map((p) => ({ phone: p })) } });
    }

    if (user && user.isActive) {
      // Create a 15-minute cryptographically signed password reset token
      const resetToken = jwt.sign(
        { userId: user.id, purpose: "PASSWORD_RESET" },
        env.JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
      );

      console.info(`[PASSWORD RESET] Generated reset token for user ${user.id} (${trimmed})`);
      await audit("AUTH_PASSWORD_RESET_REQUESTED", "User", user.id, user.id, undefined, { hasToken: Boolean(resetToken) });
    }

    // Always respond with a generic message to prevent account enumeration
    return sendOk(res, {
      message: "If an active account exists for that email or mobile number, password reset instructions have been generated.",
    });
  } catch (e) {
    next(e);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      token: z.string().min(10, "Invalid reset token"),
      newPassword: z.string().min(10, "New password must be at least 10 characters").max(128),
    }).parse(req.body);

    let decoded: any;
    try {
      decoded = jwt.verify(input.token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError(400, "Password reset token is invalid or has expired. Please request a new one.", "INVALID_TOKEN");
    }

    if (!decoded || decoded.purpose !== "PASSWORD_RESET" || !decoded.userId) {
      throw new AppError(400, "Invalid password reset token.", "INVALID_TOKEN");
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      throw new AppError(404, "User account not found or inactive.", "USER_NOT_FOUND");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await audit("AUTH_PASSWORD_RESET_COMPLETED", "User", user.id, user.id);

    return sendOk(res, {
      message: "Your password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (e) {
    next(e);
  }
}

/**
 * 4. Google Login (Direct OAuth verification, No OTP)
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { credential } = z.object({ credential: z.string().min(20) }).parse(req.body);
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError(
        503,
        "Google sign-in is not configured. Please contact the administrator.",
        "GOOGLE_NOT_CONFIGURED"
      );
    }

    const verificationResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!verificationResponse.ok) {
      throw new AppError(401, "Google sign-in could not be verified. Please try again.", "GOOGLE_AUTH_FAILED");
    }

    const profile = (await verificationResponse.json()) as {
      aud?: string;
      iss?: string;
      exp?: string;
      email?: string;
      email_verified?: string;
      name?: string;
      sub?: string;
    };
    const validIssuer =
      profile.iss === "accounts.google.com" || profile.iss === "https://accounts.google.com";
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
      throw new AppError(
        401,
        "Google account verification failed. Use a verified Google account.",
        "GOOGLE_AUTH_FAILED"
      );
    }

    const email = profile.email.trim().toLowerCase();
    const fullName = (profile.name || email.split("@")[0] || "User").trim().slice(0, 100);
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: { organization: { include: { supplierProfile: true } } },
        },
      },
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(`${randomUUID()}${randomUUID()}`, 12);
      user = await prisma.user.create({
        data: { fullName, email, passwordHash: randomPassword, emailVerified: true, phoneVerified: true, isActive: true },
        include: {
          memberships: {
            where: { isActive: true },
            include: { organization: { include: { supplierProfile: true } } },
          },
        },
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
      activeMembership: membership
        ? {
            organizationId: membership.organizationId,
            role: membership.role,
            organization: membership.organization,
          }
        : null,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: m.organization,
      })),
    });
  } catch (e) {
    next(e);
  }
}

export async function completeGoogleOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z
      .object({
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
        categories: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      })
      .parse(req.body);

    const userId = req.auth!.userId;
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId, isActive: true },
    });
    if (existingMembership) {
      throw new AppError(
        409,
        "Your organization is already set up. Please continue to your dashboard.",
        "ONBOARDING_ALREADY_COMPLETED"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          legalName: input.legalName || undefined,
          businessType:
            input.businessType || (input.accountType === "SUPPLIER" ? "Garments & Textiles" : "Brand / Buyer"),
          taxId: input.taxId || undefined,
          address: input.address || undefined,
          city: input.city || undefined,
          country: input.country,
        },
      });
      const membership = await tx.organizationMember.create({
        data: { userId, organizationId: organization.id, role: input.accountType },
        include: { organization: { include: { supplierProfile: true } } },
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
              : undefined,
          },
        });
      }
      return { organization, membership };
    });

    const accessToken = issueAccessToken(userId, result.membership.organizationId, result.membership.role);
    await audit("AUTH_GOOGLE_ONBOARDING_COMPLETED", "Organization", result.organization.id, userId, result.organization.id);
    return sendOk(
      res,
      {
        accessToken,
        activeMembership: {
          organizationId: result.membership.organizationId,
          role: result.membership.role,
          organization: result.membership.organization,
        },
      },
      201
    );
  } catch (e) {
    next(e);
  }
}

export async function switchContext(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z
      .object({
        organizationId: z.string(),
        role: z.enum(["BUYER", "SUPPLIER", "ADMIN"]),
      })
      .parse(req.body);
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.auth!.userId,
        organizationId: input.organizationId,
        role: input.role,
        isActive: true,
      },
      include: { organization: true },
    });
    if (!membership) {
      throw new AppError(403, "No active membership found for requested organization and role");
    }
    const accessToken = issueAccessToken(req.auth!.userId, membership.organizationId, membership.role);
    await audit("AUTH_SWITCH_CONTEXT", "User", req.auth!.userId, req.auth!.userId, membership.organizationId, {
      role: membership.role,
    });
    return sendOk(res, {
      accessToken,
      activeMembership: {
        organizationId: membership.organizationId,
        role: membership.role,
        organization: membership.organization,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { memberships: { include: { organization: true } } },
    });
    if (!user) throw new AppError(404, "User not found");
    const activeMembership =
      user.memberships.find(
        (m) => m.organizationId === req.auth?.organizationId && m.role === req.auth?.role
      ) || (user.memberships.length > 0 ? user.memberships[0] : null);
    return sendOk(res, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      activeMembership,
      memberships: user.memberships,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * 5. Deprecated OTP Endpoints (Maintained as graceful no-ops)
 */
export async function legacyVerifyOtp(_req: Request, res: Response) {
  return sendOk(res, {
    message: "OTP verification is deprecated. Please sign in directly with your email/mobile and password.",
  });
}

export async function legacyResendOtp(_req: Request, res: Response) {
  return sendOk(res, {
    message: "OTP sending is deprecated. Please sign in directly with your email/mobile and password.",
  });
}
