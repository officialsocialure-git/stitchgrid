import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError, sendOk } from "../utils/http";
import { issueOtp, verifyOtp } from "../services/otp";
import { sendEmailOtp, sendSmsOtp } from "../services/messaging";
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
  try {
    const input = signupSchema.parse(req.body);
    const normalizedEmail = input.email && input.email.trim() ? input.email.trim().toLowerCase() : undefined;
    const rawPhone = input.phone && input.phone.trim() ? input.phone.trim().replace(/\s+/g, "") : undefined;

    if (normalizedEmail && (await prisma.user.findUnique({ where: { email: normalizedEmail } }))) {
      throw new AppError(409, "Email already registered");
    }

    if (rawPhone) {
      const digitsOnly = rawPhone.replace(/\D/g, "");
      const phoneVariants = Array.from(new Set([
        rawPhone,
        digitsOnly,
        digitsOnly.startsWith("91") && digitsOnly.length === 12 ? digitsOnly.slice(2) : null,
        digitsOnly.length === 10 ? `+91${digitsOnly}` : null,
        digitsOnly.length === 10 ? digitsOnly : null,
        `+${digitsOnly}`
      ].filter(Boolean) as string[]));

      const existingPhone = await prisma.user.findFirst({
        where: { OR: phoneVariants.map(p => ({ phone: p })) }
      });
      if (existingPhone) throw new AppError(409, "Phone already registered");
    }
    
    const user = await prisma.user.create({ data: {
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      phone: rawPhone,
      passwordHash: await bcrypt.hash(input.password, 12)
    }});

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
    await prisma.organizationMember.createMany({ data: roles.map(role => ({ userId: user.id, organizationId: organization.id, role: role as "BUYER" | "SUPPLIER" })) });
    
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

    const destination = input.email ?? input.phone!;
    const otp = await issueOtp(destination);
    if (input.email) await sendEmailOtp(input.email, otp); else await sendSmsOtp(input.phone!, otp);
    await audit("AUTH_SIGNUP", "User", user.id, user.id, organization.id);
    return sendOk(res, { userId: user.id, organizationId: organization.id, verificationChannel: input.email ? "email" : "sms", message: "Account created. Verify the OTP to continue.", devOtp: env.NODE_ENV !== "production" ? otp : undefined }, 201);
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
    const otp = await issueOtp(destination);
    if (isEmail) await sendEmailOtp(destination, otp); else await sendSmsOtp(destination, otp);
    return sendOk(res, { challengeId: user.id, userId: user.id, destination, verificationChannel: isEmail ? "email" : "sms", message: "OTP sent. Verify to complete login.", devOtp: env.NODE_ENV !== "production" ? otp : undefined });
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
    const destination = input.destination || (user.email ?? user.phone);
    if (!destination) throw new AppError(400, "OTP destination not found for this account");
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
    const otp = await issueOtp(input.destination);
    if (channel(input.destination) === "email") await sendEmailOtp(input.destination, otp); else await sendSmsOtp(input.destination, otp);
    return sendOk(res, { message: "OTP sent" });
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
    const input = z.object({
      credential: z.string().optional(),
      email: z.string().email().optional(),
      name: z.string().optional(),
      googleId: z.string().optional()
    }).refine(d => !!(d.credential || d.email), "Credential or email is required")
      .parse(req.body);

    let email = input.email ? input.email.trim().toLowerCase() : "";
    let fullName = input.name || "";

    if (input.credential) {
      try {
        const decoded = jwt.decode(input.credential) as any;
        if (decoded?.email) {
          email = decoded.email.trim().toLowerCase();
          fullName = decoded.name || fullName;
        }
      } catch {
        // fallback to provided email
      }
    }

    if (!email) {
      throw new AppError(400, "Unable to extract email from Google profile", "GOOGLE_AUTH_FAILED");
    }

    let user: any = await prisma.user.findUnique({
      where: { email },
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

    if (!user) {
      const generatedName = fullName || email.split("@")[0] || "User";
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      const newUser = await prisma.user.create({
        data: {
          fullName: generatedName,
          email,
          passwordHash: randomPassword,
          emailVerified: true,
          isActive: true
        }
      });

      const org = await prisma.organization.create({
        data: {
          name: `${generatedName}'s Enterprise`,
          businessType: "Garments & Textiles",
          verificationStatus: "APPROVED"
        }
      });

      const membership = await prisma.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: org.id,
          role: "BUYER"
        },
        include: {
          organization: {
            include: {
              supplierProfile: true
            }
          }
        }
      });

      user = {
        ...newUser,
        memberships: [membership]
      };
    } else {
      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true }
        });
      }
    }

    if (!user) throw new AppError(500, "User not found or failed to create");

    const membership = user.memberships && user.memberships.length > 0 ? user.memberships[0] : null;
    const accessToken = issueAccessToken(user.id, membership?.organizationId, membership?.role);
    await audit("AUTH_LOGIN_GOOGLE", "User", user.id, user.id, membership?.organizationId);

    return sendOk(res, {
      accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone },
      activeMembership: membership ? { organizationId: membership.organizationId, role: membership.role, organization: membership.organization } : null,
      memberships: user.memberships.map((m: any) => ({ organizationId: m.organizationId, role: m.role, organization: m.organization }))
    });
  } catch (e) {
    next(e);
  }
}
