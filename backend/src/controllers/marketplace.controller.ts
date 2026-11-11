import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { getCache, setCache, invalidateCachePattern } from "../services/cache";
import {
  emitGlobalSync,
  emitToMarketplace,
  emitToOrg,
  emitToRole
} from "../services/realtime";

const GARMENT_SYNONYMS = [
  "garment", "apparel", "t-shirt", "shirt", "hoodie", "activewear", "denim",
  "jeans", "polo", "dress", "trouser", "knitwear", "kids", "woven"
];
const FABRIC_SYNONYMS = [
  "fabric", "woven", "mill", "cotton", "linen", "polyester", "silk", "yarn", "knitted fabric", "textile"
];
const TRIMS_SYNONYMS = [
  "trim", "trims", "button", "buttons", "zipper", "zippers", "label", "labels", "accessories", "elastic", "thread"
];
const JOBWORK_SYNONYMS = [
  "job work", "jobwork", "cutting", "stitching", "printing", "washing", "embroidery", "finishing", "packing", "dyeing"
];

function matchesCategoryFilter(
  filter: string,
  categoryNames: string[],
  businessType: string | null | undefined,
  description: string | null | undefined
): boolean {
  const norm = filter.toLowerCase().trim();
  if (!norm || norm === "all") return true;

  const combined = [
    ...categoryNames,
    businessType || "",
    description || ""
  ].join(" ").toLowerCase();

  if (norm.includes("garment")) {
    return GARMENT_SYNONYMS.some((syn) => combined.includes(syn));
  }
  if (norm.includes("fabric")) {
    return FABRIC_SYNONYMS.some((syn) => combined.includes(syn));
  }
  if (norm.includes("trim")) {
    return TRIMS_SYNONYMS.some((syn) => combined.includes(syn));
  }
  if (norm.includes("job")) {
    return JOBWORK_SYNONYMS.some((syn) => combined.includes(syn));
  }

  return combined.includes(norm);
}

export async function supplierSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const category =
      typeof req.query.category === "string" && req.query.category !== "All"
        ? req.query.category.trim().toLowerCase()
        : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim().toLowerCase() : "";

    // 1. Check Redis / Memory Cache first (sub-5ms response)
    const cacheKey = `cache:suppliers:${category || "all"}:${city || "all"}:${q || "all"}`;
    const cachedRows = await getCache<any[]>(cacheKey);
    if (cachedRows) {
      return sendOk(res, cachedRows);
    }

    // 2. Fetch supplier organizations if cache miss
    let organizations = await prisma.organization.findMany({
      where: {
        verificationStatus: { in: ["APPROVED", "PENDING"] },
        members: { some: { role: "SUPPLIER", isActive: true } },
      },
      include: {
        supplierProfile: {
          include: {
            categories: true,
            catalogItems: { where: { moderationStatus: "APPROVED" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    // If database has no supplier organizations yet, seed curated verified textile hubs
    if (organizations.length === 0) {
      organizations = [
        {
          id: "seed-org-tirupur",
          name: "Tirupur Knits & Export Mills",
          legalName: "Tirupur Knits & Export Mills Private Limited",
          businessType: "Garments & Textiles",
          taxId: "33AAACT1234F1Z5",
          address: "SIDCO Industrial Estate",
          city: "Tirupur",
          country: "India",
          verificationStatus: "APPROVED",
          createdAt: new Date(),
          updatedAt: new Date(),
          supplierProfile: {
            id: "seed-sup-tirupur",
            organizationId: "seed-org-tirupur",
            description: "Leading OEKO-TEX certified garment export house specializing in premium single jersey, piqué and terry fabrics. | MOQ: 250 pcs | Capacity: 50,000 pcs / month | Tags: Knits · Cotton Hosiery · Bio-Washed",
            yearsInBusiness: 14,
            productionCapacity: 50000,
            verificationStatus: "APPROVED",
            createdAt: new Date(),
            updatedAt: new Date(),
            categories: [
              { id: "cat-1", supplierProfileId: "seed-sup-tirupur", category: "T-Shirts" },
              { id: "cat-2", supplierProfileId: "seed-sup-tirupur", category: "Hoodies" },
              { id: "cat-3", supplierProfileId: "seed-sup-tirupur", category: "Activewear" }
            ],
            catalogItems: [
              { id: "c1", supplierProfileId: "seed-sup-tirupur", name: "Combed Cotton T-Shirt", description: "180 GSM", unitPrice: 185 as any, minOrderQty: 250, leadTimeDays: 14, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() },
              { id: "c2", supplierProfileId: "seed-sup-tirupur", name: "French Terry Hoodie", description: "320 GSM", unitPrice: 480 as any, minOrderQty: 200, leadTimeDays: 20, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() }
            ]
          }
        } as any,
        {
          id: "seed-org-surat",
          name: "Surat Tex Fab Weaving Mills",
          legalName: "Surat Tex Fab Weaving Mills LLP",
          businessType: "Fabric Mill",
          taxId: "24AAACS5678B1Z2",
          address: "Ring Road Textile Hub",
          city: "Surat",
          country: "India",
          verificationStatus: "APPROVED",
          createdAt: new Date(),
          updatedAt: new Date(),
          supplierProfile: {
            id: "seed-sup-surat",
            organizationId: "seed-org-surat",
            description: "State-of-the-art waterjet looms mill producing dyed & printed synthetic, rayon and blended apparel fabrics. | MOQ: 500 meters | Capacity: 120,000 meters / month | Tags: Viscose · Polyester Silk · Georgette",
            yearsInBusiness: 18,
            productionCapacity: 120000,
            verificationStatus: "APPROVED",
            createdAt: new Date(),
            updatedAt: new Date(),
            categories: [
              { id: "cat-4", supplierProfileId: "seed-sup-surat", category: "Fabric" },
              { id: "cat-5", supplierProfileId: "seed-sup-surat", category: "Dresses" }
            ],
            catalogItems: [
              { id: "c3", supplierProfileId: "seed-sup-surat", name: "Micro Polyester Crepe", description: "Fabric roll", unitPrice: 95 as any, minOrderQty: 500, leadTimeDays: 10, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() },
              { id: "c4", supplierProfileId: "seed-sup-surat", name: "Viscose Rayon 140 GSM", description: "Woven fabric", unitPrice: 110 as any, minOrderQty: 500, leadTimeDays: 12, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() }
            ]
          }
        } as any,
        {
          id: "seed-org-ludhiana",
          name: "Ludhiana Wool & Winter Mills",
          legalName: "Ludhiana Wool & Winter Mills Ltd",
          businessType: "Garments & Textiles",
          taxId: "03AAACL9101C1Z8",
          address: "Focal Point Phase IV",
          city: "Ludhiana",
          country: "India",
          verificationStatus: "APPROVED",
          createdAt: new Date(),
          updatedAt: new Date(),
          supplierProfile: {
            id: "seed-sup-ludhiana",
            organizationId: "seed-org-ludhiana",
            description: "Specialized winterwear manufacturer with Shima Seiki computer flat knitting machines and computerized embroidery. | MOQ: 300 pcs | Capacity: 35,000 pcs / month | Tags: Woollens · Flat-Knit Sweaters · Thermals",
            yearsInBusiness: 22,
            productionCapacity: 35000,
            verificationStatus: "APPROVED",
            createdAt: new Date(),
            updatedAt: new Date(),
            categories: [
              { id: "cat-6", supplierProfileId: "seed-sup-ludhiana", category: "Knitwear" },
              { id: "cat-7", supplierProfileId: "seed-sup-ludhiana", category: "Winterwear" },
              { id: "cat-8", supplierProfileId: "seed-sup-ludhiana", category: "Shirts" }
            ],
            catalogItems: [
              { id: "c5", supplierProfileId: "seed-sup-ludhiana", name: "Merino Wool Blend Pullover", description: "Warm knitwear", unitPrice: 650 as any, minOrderQty: 300, leadTimeDays: 25, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() }
            ]
          }
        } as any,
        {
          id: "seed-org-jaipur",
          name: "Jaipur Heritage Block Prints & Apparel",
          legalName: "Jaipur Heritage Prints Pvt Ltd",
          businessType: "Job work & Dyeing",
          taxId: "08AAACJ3456D1Z1",
          address: "Sanganer Export Cluster",
          city: "Jaipur",
          country: "India",
          verificationStatus: "APPROVED",
          createdAt: new Date(),
          updatedAt: new Date(),
          supplierProfile: {
            id: "seed-sup-jaipur",
            organizationId: "seed-org-jaipur",
            description: "Artisanal textile unit with automated screen and manual wooden block printing, pigment dyeing and custom stitching. | MOQ: 200 pcs | Capacity: 25,000 pcs / month | Tags: Hand Block Print · Natural Dyes · Cottons",
            yearsInBusiness: 11,
            productionCapacity: 25000,
            verificationStatus: "APPROVED",
            createdAt: new Date(),
            updatedAt: new Date(),
            categories: [
              { id: "cat-9", supplierProfileId: "seed-sup-jaipur", category: "Ethnic Wear" },
              { id: "cat-10", supplierProfileId: "seed-sup-jaipur", category: "Job work" },
              { id: "cat-11", supplierProfileId: "seed-sup-jaipur", category: "Shirts" }
            ],
            catalogItems: [
              { id: "c6", supplierProfileId: "seed-sup-jaipur", name: "Indigo Handblock Cotton Shirt", description: "Pure cotton", unitPrice: 340 as any, minOrderQty: 200, leadTimeDays: 14, moderationStatus: "APPROVED", createdAt: new Date(), updatedAt: new Date() }
            ]
          }
        } as any
      ];
    }

    const rows = organizations
      .filter((organization) => {
        const profile = organization.supplierProfile;
        const categoryNames = profile?.categories.map((item) => item.category.toLowerCase()) ?? [];
        const searchable = [
          organization.name,
          organization.legalName,
          organization.businessType,
          organization.city,
          organization.address,
          profile?.description,
          ...categoryNames,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (city && !(organization.city ?? "").toLowerCase().includes(city)) return false;
        if (category && !matchesCategoryFilter(category, categoryNames, organization.businessType, profile?.description)) {
          return false;
        }
        if (q && !searchable.includes(q)) return false;
        return true;
      })
      .map((organization) => {
        const profile = organization.supplierProfile;
        return {
          id: profile?.id ?? organization.id,
          organizationId: organization.id,
          description: profile?.description ?? null,
          yearsInBusiness: profile?.yearsInBusiness ?? null,
          productionCapacity: profile?.productionCapacity ?? null,
          verificationStatus: organization.verificationStatus,
          organization: {
            id: organization.id,
            name: organization.name,
            legalName: organization.legalName,
            businessType: organization.businessType,
            taxId: organization.taxId,
            address: organization.address,
            city: organization.city,
            country: organization.country,
            verificationStatus: organization.verificationStatus,
          },
          categories: profile?.categories ?? [],
          catalogItems: profile?.catalogItems ?? [],
        };
      });

    // Cache the filtered supplier results for 60 seconds
    await setCache(cacheKey, rows, 60);

    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function upsertSupplierProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string(),
      description: z.string().max(4000).optional(),
      yearsInBusiness: z.number().int().min(0).optional(),
      productionCapacity: z.number().int().min(0).optional(),
      categories: z.array(z.string().min(1).max(100)).max(30).optional(),
      name: z.string().min(2).max(150).optional(),
      taxId: z.string().max(30).optional(),
      city: z.string().max(100).optional(),
      address: z.string().max(300).optional(),
    }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true } });
    if (!membership) throw new AppError(403, "Supplier membership required");

    if (input.name || input.taxId !== undefined || input.city !== undefined || input.address !== undefined) {
      const orgData: any = {};
      if (input.name) orgData.name = input.name;
      if (input.taxId !== undefined) orgData.taxId = input.taxId;
      if (input.city !== undefined) orgData.city = input.city;
      if (input.address !== undefined) orgData.address = input.address;
      await prisma.organization.update({
        where: { id: input.organizationId },
        data: orgData
      });
    }

    const profile = await prisma.supplierProfile.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        description: input.description,
        yearsInBusiness: input.yearsInBusiness,
        productionCapacity: input.productionCapacity
      },
      update: {
        description: input.description,
        yearsInBusiness: input.yearsInBusiness,
        productionCapacity: input.productionCapacity
      }
    });
    if (input.categories) {
      await prisma.supplierCategory.deleteMany({ where: { supplierProfileId: profile.id } });
      await prisma.supplierCategory.createMany({ data: input.categories.map(category => ({ supplierProfileId: profile.id, category })), skipDuplicates: true });
    }
    await invalidateCachePattern("cache:suppliers:");
    await audit("SUPPLIER_PROFILE_UPDATED", "SupplierProfile", profile.id, req.auth!.userId, input.organizationId);
    emitToMarketplace("supplier:updated", { organizationId: input.organizationId });
    emitToRole("BUYER", "supplier:updated", { organizationId: input.organizationId });
    return sendOk(res, profile);
  } catch (e) { next(e); }
}

export async function updateOrganizationProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string(),
      name: z.string().min(2).max(150).optional(),
      legalName: z.string().max(150).optional(),
      businessType: z.string().max(80).optional(),
      taxId: z.string().max(30).optional(),
      city: z.string().max(100).optional(),
      address: z.string().max(300).optional(),
      country: z.string().max(80).optional(),
      description: z.string().max(4000).optional(),
      yearsInBusiness: z.number().int().min(0).optional(),
      productionCapacity: z.number().int().min(0).optional(),
      categories: z.array(z.string().min(1).max(100)).max(30).optional(),
    }).parse(req.body);

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.organizationId, isActive: true }
    });
    if (!membership) throw new AppError(403, "Membership in organization required");

    const orgUpdateData: any = {};
    if (input.name) orgUpdateData.name = input.name;
    if (input.legalName !== undefined) orgUpdateData.legalName = input.legalName;
    if (input.businessType !== undefined) orgUpdateData.businessType = input.businessType;
    if (input.taxId !== undefined) orgUpdateData.taxId = input.taxId;
    if (input.city !== undefined) orgUpdateData.city = input.city;
    if (input.address !== undefined) orgUpdateData.address = input.address;
    if (input.country !== undefined) orgUpdateData.country = input.country;

    const org = await prisma.organization.update({
      where: { id: input.organizationId },
      data: orgUpdateData
    });

    if (membership.role === "SUPPLIER" || input.description || input.yearsInBusiness || input.productionCapacity || input.categories) {
      const profile = await prisma.supplierProfile.upsert({
        where: { organizationId: input.organizationId },
        create: {
          organizationId: input.organizationId,
          description: input.description,
          yearsInBusiness: input.yearsInBusiness,
          productionCapacity: input.productionCapacity,
        },
        update: {
          description: input.description,
          yearsInBusiness: input.yearsInBusiness,
          productionCapacity: input.productionCapacity,
        }
      });

      if (input.categories) {
        await prisma.supplierCategory.deleteMany({ where: { supplierProfileId: profile.id } });
        await prisma.supplierCategory.createMany({
          data: input.categories.map(category => ({ supplierProfileId: profile.id, category })),
          skipDuplicates: true
        });
      }
    }

    await invalidateCachePattern("cache:suppliers:");
    await audit("ORGANIZATION_PROFILE_UPDATED", "Organization", org.id, req.auth!.userId, org.id);
    emitToMarketplace("supplier:updated", { organizationId: org.id });
    emitToRole("BUYER", "supplier:updated", { organizationId: org.id });
    return sendOk(res, org);
  } catch (e) { next(e); }
}

export async function createRfq(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      buyerOrgId: z.string(),
      title: z.string().min(3).max(200),
      description: z.string().max(8000).optional(),
      garmentType: z.string().max(100).optional(),
      fabricSpec: z.string().max(2000).optional(),
      targetPrice: z.coerce.number().positive().optional(),
      targetQuantity: z.number().int().positive(),
      targetDate: z.coerce.date().optional(),
      status: z.enum(["DRAFT", "OPEN"]).optional(),
      supplierOrgIds: z.array(z.string()).optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().int().positive(),
        unit: z.string().default("pieces")
      })).min(1).max(100)
    }).parse(req.body);

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!membership) throw new AppError(403, "Buyer membership required");

    const rfq = await prisma.$transaction(async tx => {
      const created = await tx.rfq.create({
        data: {
          buyerOrgId: input.buyerOrgId,
          title: input.title,
          description: input.description,
          garmentType: input.garmentType,
          fabricSpec: input.fabricSpec,
          targetPrice: input.targetPrice,
          targetQuantity: input.targetQuantity,
          targetDate: input.targetDate,
          status: input.status || "OPEN",
          items: { create: input.items }
        },
        include: { items: true }
      });

      if (input.supplierOrgIds && input.supplierOrgIds.length > 0) {
        await tx.rfqInvitation.createMany({
          data: input.supplierOrgIds.map(supplierOrgId => ({
            rfqId: created.id,
            supplierOrgId,
            status: "INVITED" as const
          })),
          skipDuplicates: true
        });
      }

      return created;
    });

    await audit("RFQ_CREATED", "Rfq", rfq.id, req.auth!.userId, input.buyerOrgId);
    emitToRole("SUPPLIER", "rfq:created", { rfqId: rfq.id, title: rfq.title, buyerOrgId: input.buyerOrgId });
    emitToMarketplace("rfq:created", { rfqId: rfq.id, title: rfq.title });
    return sendOk(res, rfq, 201);
  } catch (e) { next(e); }
}

export async function inviteSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ supplierOrgId: z.string() }).parse(req.body);
    const rfqId = Array.isArray(req.params.rfqId) ? req.params.rfqId[0] : req.params.rfqId;
    const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new AppError(404, "RFQ not found");
    const buyerMember = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: rfq.buyerOrgId, role: "BUYER", isActive: true } });
    const supplierMember = await prisma.organizationMember.findFirst({ where: { organizationId: input.supplierOrgId, role: "SUPPLIER", isActive: true } });
    if (!buyerMember || !supplierMember) throw new AppError(403, "Buyer and supplier memberships are required");
    const invite = await prisma.rfqInvitation.upsert({
      where: { rfqId_supplierOrgId: { rfqId: rfq.id, supplierOrgId: input.supplierOrgId } },
      update: {},
      create: { rfqId: rfq.id, supplierOrgId: input.supplierOrgId, status: "INVITED" }
    });
    return sendOk(res, invite, 201);
  } catch (e) { next(e); }
}

export async function submitQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      rfqId: z.string(),
      supplierOrgId: z.string(),
      totalAmount: z.number().positive(),
      currency: z.string().length(3).default("INR"),
      leadTimeDays: z.number().int().positive(),
      sampleCost: z.coerce.number().nonnegative().optional(),
      sampleLeadDays: z.number().int().positive().optional(),
      moq: z.number().int().positive().optional(),
      validityUntil: z.coerce.date().optional(),
      terms: z.string().max(4000).optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        rfqItemId: z.string().optional()
      })).min(1)
    }).parse(req.body);

    const member = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.supplierOrgId, role: "SUPPLIER", isActive: true }
    });
    const rfq = await prisma.rfq.findUnique({ where: { id: input.rfqId } });
    if (!member || !rfq || rfq.status !== "OPEN") throw new AppError(403, "Active supplier membership and open RFQ required");

    const quote = await prisma.$transaction(async tx => {
      const q = await tx.quotation.create({
        data: {
          rfqId: input.rfqId,
          supplierOrgId: input.supplierOrgId,
          buyerOrgId: rfq.buyerOrgId,
          totalAmount: input.totalAmount,
          currency: input.currency,
          leadTimeDays: input.leadTimeDays,
          sampleCost: input.sampleCost,
          sampleLeadDays: input.sampleLeadDays,
          moq: input.moq,
          validityUntil: input.validityUntil,
          terms: input.terms,
          items: {
            create: input.items.map(i => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              rfqItemId: i.rfqItemId
            }))
          }
        },
        include: { items: true }
      });

      await tx.rfqInvitation.upsert({
        where: { rfqId_supplierOrgId: { rfqId: input.rfqId, supplierOrgId: input.supplierOrgId } },
        update: { status: "RESPONDED" },
        create: { rfqId: input.rfqId, supplierOrgId: input.supplierOrgId, status: "RESPONDED" }
      });

      return q;
    });

    emitToOrg(rfq.buyerOrgId, "quotation:created", { rfqId: quote.rfqId, quotationId: quote.id });
    emitToRole("BUYER", "quotation:created", { rfqId: quote.rfqId, quotationId: quote.id });
    return sendOk(res, quote, 201);
  } catch (e) { next(e); }
}

export async function listMyRfqs(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : "";
    let data;
    if (orgId) {
      const buyer = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: orgId, role: "BUYER", isActive: true } });
      const supplier = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: orgId, role: "SUPPLIER", isActive: true } });
      if (!buyer && !supplier) throw new AppError(403, "Membership required");
      data = buyer
        ? await prisma.rfq.findMany({
            where: { buyerOrgId: orgId },
            include: {
              items: true,
              quotations: {
                include: {
                  supplier: { select: { id: true, name: true, city: true } },
                  items: true
                }
              }
            },
            orderBy: { createdAt: "desc" }
          })
        : await prisma.rfq.findMany({
            where: {
              OR: [
                { invitations: { some: { supplierOrgId: orgId } } },
                { status: "OPEN" }
              ]
            },
            include: {
              items: true,
              invitations: true,
              buyer: { select: { id: true, name: true, city: true } },
              quotations: {
                where: { supplierOrgId: orgId },
                include: { items: true }
              }
            },
            orderBy: { createdAt: "desc" }
          });
    } else {
      const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
      const orgIds = memberships.map(m => m.organizationId);
      const isSupplierOnly = memberships.every(m => m.role === "SUPPLIER");

      data = await prisma.rfq.findMany({
        where: isSupplierOnly
          ? {
              OR: [
                { invitations: { some: { supplierOrgId: { in: orgIds } } } },
                { status: "OPEN" }
              ]
            }
          : {
              OR: [
                { buyerOrgId: { in: orgIds } },
                { invitations: { some: { supplierOrgId: { in: orgIds } } } }
              ]
            },
        include: {
          items: true,
          buyer: { select: { id: true, name: true, city: true } },
          quotations: {
            include: {
              supplier: { select: { id: true, name: true, city: true } },
              items: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    }
    return sendOk(res, data);
  } catch (e) { next(e); }
}

export async function getRfqDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const rfqId = Array.isArray(req.params.rfqId) ? req.params.rfqId[0] : req.params.rfqId;
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        items: true,
        invitations: true,
        quotations: {
          include: {
            items: true,
            supplier: { select: { id: true, name: true, city: true } }
          }
        },
        buyer: { select: { id: true, name: true, city: true } }
      }
    });
    if (!rfq) throw new AppError(404, "RFQ not found");
    return sendOk(res, rfq);
  } catch (e) { next(e); }
}

export async function deleteRfq(req: Request, res: Response, next: NextFunction) {
  try {
    const rfqId = Array.isArray(req.params.rfqId) ? req.params.rfqId[0] : req.params.rfqId;
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quotations: { select: { id: true } } }
    });
    if (!rfq) throw new AppError(404, "RFQ not found");

    const buyerMember = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: rfq.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!buyerMember) throw new AppError(403, "Only the buyer organization can delete this request");

    // Check for any linked purchase orders
    const quoteIds = rfq.quotations.map(q => q.id);
    if (quoteIds.length > 0) {
      const pos = await prisma.purchaseOrder.findMany({ where: { quotationId: { in: quoteIds } }, select: { id: true } });
      const poIds = pos.map(p => p.id);
      if (poIds.length > 0) {
        await prisma.sample.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
        await prisma.orderMilestone.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
        await prisma.orderEvent.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
        await prisma.paymentTransaction.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
        await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
      }
    }

    await prisma.rfq.delete({ where: { id: rfq.id } });
    await audit("RFQ_DELETED", "Rfq", rfq.id, req.auth!.userId, rfq.buyerOrgId);
    return sendOk(res, { deleted: true, id: rfq.id });
  } catch (e) { next(e); }
}

export async function listPurchaseOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const memberships = await prisma.organizationMember.findMany({ where: { userId: req.auth!.userId, isActive: true } });
    const orgIds = memberships.map(m => m.organizationId);
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { buyerOrgId: { in: orgIds } },
          { supplierOrgId: { in: orgIds } }
        ]
      },
      include: {
        buyer: { select: { id: true, name: true, city: true } },
        supplier: { select: { id: true, name: true, city: true } },
        items: true,
        milestones: { orderBy: { dueDate: "asc" } },
        samples: true
      },
      orderBy: { createdAt: "desc" }
    });
    return sendOk(res, orders);
  } catch (e) { next(e); }
}

export async function getPurchaseOrderDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        supplier: true,
        items: true,
        milestones: { orderBy: { dueDate: "asc" } },
        samples: true,
        events: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!order) throw new AppError(404, "Order not found");
    return sendOk(res, order);
  } catch (e) { next(e); }
}

export async function createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ quotationId: z.string(), expectedDate: z.coerce.date().optional() }).parse(req.body);
    const quote = await prisma.quotation.findUnique({
      where: { id: input.quotationId },
      include: {
        items: true,
        rfq: {
          include: {
            buyer: { select: { id: true, name: true } }
          }
        },
        supplier: { select: { id: true, name: true } }
      }
    });
    if (!quote || (quote.status !== "SUBMITTED" && quote.status !== "REVISED")) {
      throw new AppError(400, "Quotation cannot be accepted (it may already be accepted or cancelled)");
    }
    const buyer = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: quote.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!buyer) throw new AppError(403, "Buyer membership required to accept quotes");

    const buyerName = quote.rfq?.buyer?.name || "Enterprise Buyer";
    const garmentTitle = quote.rfq?.title || "Garment Order";

    const order = await prisma.$transaction(async tx => {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber: `SG-PO-${year}-${rand}`,
          buyerOrgId: quote.buyerOrgId,
          supplierOrgId: quote.supplierOrgId,
          quotationId: quote.id,
          status: "PENDING_ACCEPTANCE",
          totalAmount: quote.totalAmount,
          currency: quote.currency,
          expectedDate: input.expectedDate,
          items: {
            create: quote.items.map(i => ({
              name: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice
            }))
          },
          milestones: {
            create: [
              { title: "Material Sourcing & Yarn Booking", status: "PENDING" },
              { title: "Sample Approval & Strike-off", status: "PENDING" },
              { title: "Bulk Cutting & Line Loading", status: "PENDING" },
              { title: "Stitching & Assembly", status: "PENDING" },
              { title: "Washing, Ironing & Finishing", status: "PENDING" },
              { title: "AQL 2.5 Quality Audit", status: "PENDING" },
              { title: "Dispatch & Shipment Handover", status: "PENDING" },
            ]
          },
          paymentPlan: {
            create: {
              totalAmount: quote.totalAmount,
              currency: quote.currency,
              milestones: {
                create: [
                  { title: "Order Confirmation", sequence: 1, percentage: 20, amount: Number(quote.totalAmount) * 0.20, status: "DUE" },
                  { title: "Sample Approval", sequence: 2, percentage: 20, amount: Number(quote.totalAmount) * 0.20, status: "UPCOMING" },
                  { title: "Production Completion", sequence: 3, percentage: 40, amount: Number(quote.totalAmount) * 0.40, status: "UPCOMING" },
                  { title: "QC & Dispatch", sequence: 4, percentage: 20, amount: Number(quote.totalAmount) - Number(quote.totalAmount) * 0.80, status: "UPCOMING" }
                ]
              }
            }
          },
          samples: {
            create: {
              status: "REQUESTED",
              notes: `Pre-Production (PP) Sample for ${quote.items[0]?.description || garmentTitle}`
            }
          }
        }
      });

      await tx.quotation.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });
      await tx.quotation.updateMany({
        where: { rfqId: quote.rfqId, id: { not: quote.id } },
        data: { status: "REJECTED" }
      });
      await tx.rfq.update({ where: { id: quote.rfqId }, data: { status: "AWARDED" } });

      // Order event log
      await tx.orderEvent.create({
        data: {
          purchaseOrderId: po.id,
          eventType: "PO_CREATED",
          note: `Purchase Order issued by ${buyerName}. Awaiting supplier acceptance.`,
          actorUserId: req.auth!.userId
        }
      });

      // Notify Supplier members
      const supplierMembers = await tx.organizationMember.findMany({
        where: { organizationId: quote.supplierOrgId, isActive: true },
        select: { userId: true }
      });

      if (supplierMembers.length > 0) {
        await tx.notification.createMany({
          data: supplierMembers.map(m => ({
            userId: m.userId,
            title: "🎉 New Purchase Order Received!",
            body: `Buyer "${buyerName}" accepted your quotation for "${garmentTitle}". PO #${po.poNumber} has been issued and is waiting for your acceptance.`,
          }))
        });
      }

      // Upsert Conversation & Send message
      const conv = await tx.conversation.upsert({
        where: {
          buyerOrgId_supplierOrgId: {
            buyerOrgId: quote.buyerOrgId,
            supplierOrgId: quote.supplierOrgId
          }
        },
        create: {
          buyerOrgId: quote.buyerOrgId,
          supplierOrgId: quote.supplierOrgId
        },
        update: {}
      });

      await tx.message.create({
        data: {
          conversationId: conv.id,
          senderUserId: req.auth!.userId,
          body: `🤝 Purchase Order #${po.poNumber} (₹${Number(quote.totalAmount).toLocaleString("en-IN")}) has been issued for "${garmentTitle}". Please review and click 'Accept Order' in Purchase Orders to begin fulfillment.`
        }
      });

      return po;
    });

    await audit("PURCHASE_ORDER_CREATED", "PurchaseOrder", order.id, req.auth!.userId, quote.buyerOrgId);
    emitToOrg(quote.supplierOrgId, "order:created", { orderId: order.id, poNumber: order.poNumber });
    emitToOrg(quote.buyerOrgId, "order:created", { orderId: order.id, poNumber: order.poNumber });
    return sendOk(res, order, 201);
  } catch (e) { next(e); }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      status: z.enum([
        "PO_CREATED",
        "PENDING_ACCEPTANCE",
        "ACCEPTED",
        "SAMPLE_PENDING",
        "SAMPLE_APPROVED",
        "PRODUCTION_STARTED",
        "IN_PRODUCTION",
        "QC_PENDING",
        "QC",
        "READY_TO_DISPATCH",
        "DISPATCHED",
        "DELIVERED",
        "COMPLETED",
        "CANCELLED"
      ]),
      trackingNumber: z.string().optional(),
      qcNotes: z.string().optional(),
      note: z.string().max(2000).optional()
    }).parse(req.body);

    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        supplier: { select: { id: true, name: true } },
        buyer: { select: { id: true, name: true } }
      }
    });
    if (!order) throw new AppError(404, "Order not found");

    const supplier = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true }
    });
    const buyer = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: order.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!supplier && !buyer) throw new AppError(403, "Order membership required");

    // Strictly separate actions: Only Supplier can accept a PO_CREATED / PENDING_ACCEPTANCE order
    if (input.status === "ACCEPTED" && !supplier) {
      throw new AppError(403, "Only the supplier can accept the purchase order");
    }

    const updated = await prisma.$transaction(async tx => {
      const updateData: any = { status: input.status };
      if (input.trackingNumber) updateData.trackingNumber = input.trackingNumber;
      if (input.qcNotes) updateData.qcNotes = input.qcNotes;
      if (input.status === "DISPATCHED") updateData.dispatchDate = new Date();
      if (input.status === "DELIVERED" || input.status === "COMPLETED") updateData.deliveryDate = new Date();

      const result = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: updateData
      });

      await tx.orderEvent.create({
        data: {
          purchaseOrderId: order.id,
          eventType: input.status,
          note: input.note || (input.trackingNumber ? `Shipment Tracking: ${input.trackingNumber}` : undefined),
          actorUserId: req.auth!.userId
        }
      });

      // If supplier accepted order, notify the buyer
      if (input.status === "ACCEPTED") {
        const buyerMembers = await tx.organizationMember.findMany({
          where: { organizationId: order.buyerOrgId, isActive: true },
          select: { userId: true }
        });
        if (buyerMembers.length > 0) {
          await tx.notification.createMany({
            data: buyerMembers.map(m => ({
              userId: m.userId,
              title: "✅ Purchase Order Accepted by Supplier!",
              body: `Supplier "${order.supplier?.name || "Factory"}" has accepted PO #${order.poNumber}. Manufacturing & sampling workflow is now underway.`,
            }))
          });
        }

        const conv = await tx.conversation.findUnique({
          where: {
            buyerOrgId_supplierOrgId: {
              buyerOrgId: order.buyerOrgId,
              supplierOrgId: order.supplierOrgId
            }
          }
        });
        if (conv) {
          await tx.message.create({
            data: {
              conversationId: conv.id,
              senderUserId: req.auth!.userId,
              body: `✅ We have accepted Purchase Order #${order.poNumber}! Pre-production sampling preparation has begun.`
            }
          });
        }
      }

      return result;
    });

    await audit("ORDER_STATUS_UPDATED", "PurchaseOrder", order.id, req.auth!.userId, supplier ? order.supplierOrgId : order.buyerOrgId);
    emitToOrg(order.buyerOrgId, "order:updated", { orderId: order.id, status: input.status });
    emitToOrg(order.supplierOrgId, "order:updated", { orderId: order.id, status: input.status });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function adminVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(2000).optional() }).parse(req.body);
    const organizationId = Array.isArray(req.params.organizationId) ? req.params.organizationId[0] : req.params.organizationId;
    const org = await prisma.organization.update({ where: { id: organizationId }, data: { verificationStatus: input.status } });
    await prisma.supplierProfile.updateMany({ where: { organizationId: org.id }, data: { verificationStatus: input.status } });
    await invalidateCachePattern("cache:suppliers:");
    await audit("BUSINESS_VERIFICATION", "Organization", org.id, req.auth!.userId, undefined, { status: input.status, note: input.note });
    emitGlobalSync("admin:verification_updated", { organizationId: org.id, status: input.status });
    emitToMarketplace("supplier:updated", { organizationId: org.id });
    return sendOk(res, org);
  } catch (e) { next(e); }
}

export async function listAdminOrganizations(_req: Request, res: Response, next: NextFunction) {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } }
          }
        },
        supplierProfile: {
          include: {
            categories: true
          }
        },
        _count: {
          select: {
            buyerOrders: true,
            supplierOrders: true,
            rfqs: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return sendOk(res, orgs);
  } catch (e) { next(e); }
}