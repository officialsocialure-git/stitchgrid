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
  emitToRole,
  emitToUser
} from "../services/realtime";

const GARMENT_SYNONYMS = [
  "garment", "apparel", "t-shirt", "shirt", "hoodie", "activewear", "denim",
  "jeans", "polo", "dress", "trouser", "knitwear", "kids", "woven"
];
const FABRIC_SYNONYMS = [
  "fabric", "woven", "mill", "cotton", "linen", "polyester", "silk", "yarn", "knitted fabric", "textile"
];
const SAMPLING_SYNONYMS = [
  "sampling", "sample", "proto", "fit sample", "size set", "pre-production", "production sample", "fabric sample", "trim sample", "print sample", "embroidery sample", "wash sample", "counter sample", "photo sample", "salesman sample", "pattern development", "tech pack", "pattern making"
];
const TRIMS_SYNONYMS = [
  "trim", "trims", "button", "buttons", "zipper", "zippers", "label", "labels", "accessories", "elastic", "thread", "threads", "lace", "laces", "ribbon", "ribbons", "hook", "hooks", "interlining", "buckle", "buckles", "rivet", "rivets", "eyelet", "eyelets", "drawcord", "drawcords", "patch", "patches", "velcro", "snap", "snaps", "d-ring", "d-rings"
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
  if (norm.includes("sampling") || norm.includes("sample")) {
    return SAMPLING_SYNONYMS.some((syn) => combined.includes(syn));
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
    const region = typeof req.query.region === "string" ? req.query.region.trim().toLowerCase() : "";
    const businessType = typeof req.query.businessType === "string" ? req.query.businessType.trim().toLowerCase() : "";
    const minMoq = typeof req.query.minMoq === "string" && req.query.minMoq.trim() ? Number(req.query.minMoq) : null;
    const itemTypesParam = typeof req.query.itemTypes === "string" ? req.query.itemTypes : typeof req.query.garmentTypes === "string" ? req.query.garmentTypes : "";
    const itemTypes = itemTypesParam.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

    // 1. Check Redis / Memory Cache first (sub-5ms response)
    const cacheKey = `cache:suppliers:${category || "all"}:${city || "all"}:${region || "all"}:${businessType || "all"}:${minMoq ?? "all"}:${itemTypes.join(",") || "all"}:${q || "all"}`;
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
            capabilities: true,
            workforceResources: { orderBy: { resource: "asc" } },
            catalogItems: { include: { images: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" } },
            certifications: { orderBy: { createdAt: "desc" } },
          },
        },
        businessMedia: { orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }] },
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
            minimumOrderQuantity: 250,
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
            fabricMinimumOrderQuantity: 500,
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
            minimumOrderQuantity: 300,
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
        if (region && !(String((organization as any).serviceableRegions || "").toLowerCase().includes(region) || (organization.city ?? "").toLowerCase().includes(region))) return false;
        if (category && !matchesCategoryFilter(category, categoryNames, organization.businessType, profile?.description)) {
          return false;
        }
        if (businessType) {
          const capabilityValues = ((profile as any)?.capabilities ?? []).map((item: any) => String(item.value || "")).join(" ");
          const businessText = [organization.businessType || "", profile?.description || "", capabilityValues, ...categoryNames].join(" ").toLowerCase();
          if (category.includes("sampling")) {
            if (businessType.includes("job")) {
              if (!/job.?work|sampling|sample|proto|fit|pattern|tech.?pack|embroidery|printing|wash/.test(businessText)) return false;
            } else if (businessType.includes("studio") || businessType.includes("development") || businessType.includes("pattern")) {
              if (!/sampling|sample|studio|develop|pattern|proto|fit|tech.?pack/.test(businessText)) return false;
            }
          } else if (category.includes("trim")) {
            if (businessType.includes("job")) {
              if (!/job.?work|trim|button|zipper|label|elastic|thread|lace|ribbon|accessor|stitch|attachment|finishing/.test(businessText)) return false;
            } else if (businessType.includes("manufactur")) {
              if (!/manufactur|factory|production|button|zipper|label|elastic|thread|lace|ribbon|trim/.test(businessText)) return false;
            } else if (businessType.includes("trading") || businessType.includes("wholesale")) {
              if (!/trad|wholesale|distribut|stockist|supplier|merchant|trim|button|zipper|label/.test(businessText)) return false;
            }
          } else if (businessType.includes("job")) {
            if (!/job.?work|stitch|cutting|printing|washing|embroidery|finishing|packing|dyeing|weaving|knitting/.test(businessText)) return false;
          } else if (businessType.includes("garment")) {
            if (!matchesCategoryFilter("Garment", categoryNames, organization.businessType, profile?.description)) return false;
          } else if (businessType.includes("fabric") && businessType.includes("manufactur")) {
            if (!matchesCategoryFilter("Fabric", categoryNames, organization.businessType, profile?.description) || !/manufactur|manufacturer|mill|weav|loom|knit|textile|factory|production/.test(businessText)) return false;
          } else if (businessType.includes("trading") || businessType.includes("wholesale")) {
            if (!matchesCategoryFilter("Fabric", categoryNames, organization.businessType, profile?.description) || !/trad|wholesale|distribut|stockist|supplier|merchant/.test(businessText)) return false;
          }
        }
        if (itemTypes.length) {
          const catalogText = (profile?.catalogItems ?? []).map((item: any) => [item.name, item.description].filter(Boolean).join(" ")).join(" ").toLowerCase();
          const capabilityText = ((profile as any)?.capabilities ?? []).map((item: any) => String(item.value || "")).join(" ").toLowerCase();
          const availableItems = [...categoryNames, catalogText, capabilityText, profile?.description?.toLowerCase() ?? ""];
          if (!itemTypes.some((type) => availableItems.some((value) => value.includes(type)))) return false;
        }
        if (minMoq !== null && Number.isFinite(minMoq)) {
          const profileMoq = Number(category.includes('fabric') ? (profile as any)?.fabricMinimumOrderQuantity || 0 : (profile as any)?.minimumOrderQuantity || 0);
          const catalogMoqs = category.includes("fabric") ? [] : (profile?.catalogItems ?? []).map((item: any) => Number(item.moq ?? item.minOrderQty ?? 0)).filter((value: number) => value > 0);
          const supplierMoq = profileMoq > 0 ? profileMoq : catalogMoqs.length ? Math.min(...catalogMoqs) : 0;
          if (!supplierMoq || supplierMoq > minMoq) return false;
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
            serviceableRegions: (organization as any).serviceableRegions ?? null,
            country: organization.country,
            verificationStatus: organization.verificationStatus,
          },
          categories: profile?.categories ?? [],
          capabilities: (profile as any)?.capabilities ?? [],
          minimumOrderQuantity: (profile as any)?.minimumOrderQuantity ?? null,
          fabricMinimumOrderQuantity: (profile as any)?.fabricMinimumOrderQuantity ?? null,
          sampleDevelopment: (profile as any)?.sampleDevelopment ?? false,
          catalogItems: profile?.catalogItems ?? [],
          certifications: profile?.certifications ?? [],
          businessMedia: (organization as any).businessMedia ?? [],
        };
      });

    // Attach real review aggregates for supplier cards (no fabricated ratings).
    const organizationIds = rows.map((row: any) => row.organizationId).filter(Boolean);
    const ratingRows = organizationIds.length
      ? await prisma.review.groupBy({
          by: ["reviewedOrgId"],
          where: { reviewedOrgId: { in: organizationIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const ratingByOrganization = new Map(ratingRows.map((item) => [item.reviewedOrgId, {
      rating: item._avg.rating ? Number(item._avg.rating) : null,
      reviewCount: item._count._all,
    }]));
    const results = rows.map((row: any) => ({
      ...row,
      ...(ratingByOrganization.get(row.organizationId) || { rating: null, reviewCount: 0 }),
    }));

    // Cache the filtered supplier results for 60 seconds
    await setCache(cacheKey, results, 60);

    return sendOk(res, results);
  } catch (e) {
    next(e);
  }
}


export async function getPublicSupplierProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.params.organizationId || "").trim();
    if (!organizationId) throw new AppError(400, "Supplier organization ID is required");

    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        members: { some: { role: "SUPPLIER", isActive: true } },
      },
      select: {
        id: true,
        name: true,
        businessType: true,
        address: true,
        city: true,
        serviceableRegions: true,
        country: true,
        verificationStatus: true,
        supplierProfile: {
          include: {
            categories: true,
            capabilities: true,
            workforceResources: { orderBy: { resource: "asc" } },
            catalogItems: {
              select: { id: true, name: true, itemType: true, imageUrl: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true, imageUrl: true, sortOrder: true } } },
              orderBy: { createdAt: "desc" },
            },
            certifications: {
              select: { id: true, name: true, issuer: true, category: true, status: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        businessMedia: {
          orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }],
        },
      },
    });

    if (!organization) throw new AppError(404, "Supplier profile not found");
    const [ratingSummary, recentReviews, ratingBreakdown, supplierTestimonials] = await Promise.all([
      prisma.review.aggregate({
        where: { reviewedOrgId: organizationId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.review.findMany({
        where: { reviewedOrgId: organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { reviewedOrgId: organizationId },
        _count: { _all: true },
      }),
      prisma.supplierTestimonial.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    const reviewerIds = [...new Set(recentReviews.map((review) => review.reviewerOrgId))];
    const reviewers = reviewerIds.length
      ? await prisma.organization.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true },
        })
      : [];
    const reviewerNames = new Map(reviewers.map((item) => [item.id, item.name]));

    return sendOk(res, {
      ...organization,
      publicRating: {
        average: ratingSummary._avg.rating ?? null,
        count: ratingSummary._count._all,
        breakdown: ratingBreakdown.map((row) => ({
          rating: row.rating,
          count: row._count._all,
        })),
      },
      publicReviews: recentReviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewerName: reviewerNames.get(review.reviewerOrgId) || "Verified buyer",
      })),
      supplierTestimonials,
    });
  } catch (error) {
    next(error);
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
      serviceableRegions: z.string().max(1000).optional(),
    }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true } });
    if (!membership) throw new AppError(403, "Supplier membership required");

    if (input.name || input.taxId !== undefined || input.city !== undefined || input.address !== undefined || input.serviceableRegions !== undefined) {
      const orgData: any = {};
      if (input.name) orgData.name = input.name;
      if (input.taxId !== undefined) orgData.taxId = input.taxId;
      if (input.city !== undefined) orgData.city = input.city;
      if (input.address !== undefined) orgData.address = input.address;
      if (input.serviceableRegions !== undefined) orgData.serviceableRegions = input.serviceableRegions;
      if (input.serviceableRegions !== undefined) orgData.serviceableRegions = input.serviceableRegions;
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
      const selectedCategories = [...new Set(input.categories)];
      const existingCategories = await prisma.supplierCategory.findMany({ where: { supplierProfileId: profile.id } });
      const existingImageByName = new Map(existingCategories.map(row => [row.category, row.imageUrl]));
      await prisma.supplierCategory.deleteMany({
        where: { supplierProfileId: profile.id, category: { notIn: selectedCategories.length ? selectedCategories : ["__none__"] } }
      });
      for (const category of selectedCategories) {
        await prisma.supplierCategory.upsert({
          where: { supplierProfileId_category: { supplierProfileId: profile.id, category } },
          create: { supplierProfileId: profile.id, category },
          update: { imageUrl: existingImageByName.get(category) || null }
        });
      }
    }
    await invalidateCachePattern("cache:suppliers:");
    await audit("SUPPLIER_PROFILE_UPDATED", "SupplierProfile", profile.id, req.auth!.userId, input.organizationId);
    emitToMarketplace("supplier:updated", { organizationId: input.organizationId });
    emitToRole("BUYER", "supplier:updated", { organizationId: input.organizationId });
    return sendOk(res, profile);
  } catch (e) { next(e); }
}

export async function getOrganizationProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId, isActive: true }
    });
    if (!membership) throw new AppError(403, "Membership in organization required");
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        supplierProfile: {
          include: {
            categories: true,
            capabilities: true,
            workforceResources: { orderBy: { resource: "asc" } },
            catalogItems: { include: { images: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" } },
            certifications: { orderBy: { createdAt: "desc" } }
          }
        },
        businessMedia: { orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }] }
      }
    });
    if (!organization) throw new AppError(404, "Organization not found");
    const [ratingSummary, recentReviews, ratingBreakdown, supplierTestimonials] = await Promise.all([
      prisma.review.aggregate({ where: { reviewedOrgId: organizationId }, _avg: { rating: true }, _count: { _all: true } }),
      prisma.review.findMany({ where: { reviewedOrgId: organizationId }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.review.groupBy({ by: ["rating"], where: { reviewedOrgId: organizationId }, _count: { _all: true } }),
      prisma.supplierTestimonial.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    const reviewerIds = [...new Set(recentReviews.map(review => review.reviewerOrgId))];
    const reviewers = reviewerIds.length ? await prisma.organization.findMany({
      where: { id: { in: reviewerIds } }, select: { id: true, name: true }
    }) : [];
    const reviewerNames = new Map(reviewers.map(item => [item.id, item.name]));
    return sendOk(res, {
      ...organization,
      publicRating: { average: ratingSummary._avg.rating ?? null, count: ratingSummary._count._all, breakdown: ratingBreakdown.map(row => ({ rating: row.rating, count: row._count._all })) },
      publicReviews: recentReviews.map(review => ({
        id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt,
        reviewerName: reviewerNames.get(review.reviewerOrgId) || "Verified buyer"
      })),
      supplierTestimonials
    });
  } catch (e) { next(e); }
}

export async function updateOrganizationProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string().min(1),
      name: z.string().trim().min(2).max(150).optional(),
      legalName: z.string().trim().max(150).optional(),
      businessType: z.string().trim().max(80).optional(),
      taxId: z.string().trim().max(30).optional(),
      city: z.string().trim().max(100).optional(),
      address: z.string().trim().max(300).optional(),
      serviceableRegions: z.string().trim().max(1000).optional(),
      country: z.string().trim().max(80).optional(),
      description: z.string().max(4000).optional(),
      yearsInBusiness: z.number().int().min(0).max(150).optional(),
      productionCapacity: z.number().int().min(0).optional(),
      minimumOrderQuantity: z.number().int().min(1).max(10000000).nullable().optional(),
      fabricMinimumOrderQuantity: z.number().int().min(1).max(100000000).nullable().optional(),
      sampleDevelopment: z.boolean().optional(),
      categories: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
      categoryImages: z.array(z.object({ category: z.string().trim().min(1).max(100), imageUrl: z.string().url().max(2000) })).max(30).optional(),
      fabricExpertise: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      additionalCapabilities: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
      workforceResources: z.array(z.object({
        resource: z.string().trim().min(1).max(100),
        availability: z.enum(["IN_HOUSE", "OUTSOURCED", "NOT_AVAILABLE"]),
        headcount: z.number().int().min(0).max(100000).nullable().optional(),
      })).max(30).optional(),
    }).parse(req.body);

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true, role: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required to edit company information");

    const orgUpdateData: any = {};
    if (input.name !== undefined) orgUpdateData.name = input.name;
    if (input.legalName !== undefined) orgUpdateData.legalName = input.legalName || null;
    if (input.businessType !== undefined) orgUpdateData.businessType = input.businessType || null;
    if (input.taxId !== undefined) orgUpdateData.taxId = input.taxId || null;
    if (input.city !== undefined) orgUpdateData.city = input.city || null;
    if (input.address !== undefined) orgUpdateData.address = input.address || null;
    if (input.serviceableRegions !== undefined) orgUpdateData.serviceableRegions = input.serviceableRegions || null;
    if (input.country !== undefined) orgUpdateData.country = input.country || null;

    const org = await prisma.$transaction(async (tx) => {
      if (Object.keys(orgUpdateData).length > 0) {
        await tx.organization.update({
          where: { id: input.organizationId },
          data: orgUpdateData
        });
      }

      if (membership.role === "SUPPLIER") {
        const profile = await tx.supplierProfile.upsert({
          where: { organizationId: input.organizationId },
          create: {
            organizationId: input.organizationId,
            description: input.description,
            yearsInBusiness: input.yearsInBusiness,
            productionCapacity: input.productionCapacity,
            minimumOrderQuantity: input.minimumOrderQuantity,
            fabricMinimumOrderQuantity: input.fabricMinimumOrderQuantity,
            sampleDevelopment: input.sampleDevelopment ?? false,
          },
          update: {
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.yearsInBusiness !== undefined ? { yearsInBusiness: input.yearsInBusiness } : {}),
            ...(input.productionCapacity !== undefined ? { productionCapacity: input.productionCapacity } : {}),
            ...(input.minimumOrderQuantity !== undefined ? { minimumOrderQuantity: input.minimumOrderQuantity } : {}),
            ...(input.fabricMinimumOrderQuantity !== undefined ? { fabricMinimumOrderQuantity: input.fabricMinimumOrderQuantity } : {}),
            ...(input.sampleDevelopment !== undefined ? { sampleDevelopment: input.sampleDevelopment } : {}),
          }
        });

        if (input.categories !== undefined) {
          const existingCategories = await tx.supplierCategory.findMany({ where: { supplierProfileId: profile.id } });
          const existingImageByName = new Map(existingCategories.map(row => [row.category, row.imageUrl]));
          const selectedCategories = [...new Set(input.categories)];
          const imageByName = new Map((input.categoryImages || []).map(row => [row.category, row.imageUrl]));
          await tx.supplierCategory.deleteMany({ where: { supplierProfileId: profile.id, category: { notIn: selectedCategories.length ? selectedCategories : ["__none__"] } } });
          for (const category of selectedCategories) {
            await tx.supplierCategory.upsert({
              where: { supplierProfileId_category: { supplierProfileId: profile.id, category } },
              create: { supplierProfileId: profile.id, category, imageUrl: imageByName.get(category) || null },
              update: imageByName.has(category) ? { imageUrl: imageByName.get(category)! } : { imageUrl: existingImageByName.get(category) || null }
            });
          }
        }

        if (input.workforceResources !== undefined) {
          const resources = [...new Map(input.workforceResources.map(item => [item.resource, item])).values()];
          await tx.supplierWorkforceResource.deleteMany({ where: { supplierProfileId: profile.id } });
          if (resources.length) {
            await tx.supplierWorkforceResource.createMany({
              data: resources.map(item => ({
                supplierProfileId: profile.id,
                resource: item.resource,
                availability: item.availability,
                headcount: item.headcount ?? null,
              })),
            });
          }
        }

        if (input.fabricExpertise !== undefined || input.additionalCapabilities !== undefined) {
          const groups = [
            ...(input.fabricExpertise !== undefined ? ["FABRIC"] : []),
            ...(input.additionalCapabilities !== undefined ? ["SERVICE"] : []),
          ];
          if (groups.length) {
            await tx.supplierCapability.deleteMany({
              where: { supplierProfileId: profile.id, capabilityGroup: { in: groups } }
            });
          }
          const capabilityRows = [
            ...(input.fabricExpertise || []).map(value => ({ supplierProfileId: profile.id, capabilityGroup: "FABRIC", value })),
            ...(input.additionalCapabilities || []).map(value => ({ supplierProfileId: profile.id, capabilityGroup: "SERVICE", value })),
          ];
          if (capabilityRows.length) {
            await tx.supplierCapability.createMany({ data: capabilityRows, skipDuplicates: true });
          }
        }
      }

      return tx.organization.findUnique({
        where: { id: input.organizationId },
        include: { supplierProfile: { include: { categories: true, capabilities: true, workforceResources: { orderBy: { resource: "asc" } }, certifications: { orderBy: { createdAt: "desc" } } } } }
      });
    });

    if (!org) throw new AppError(404, "Organization not found");
    try {
      await invalidateCachePattern("cache:suppliers:");
    } catch (cacheError) {
      console.warn("[SUPPLIER PROFILE] Cache invalidation failed:", cacheError instanceof Error ? cacheError.message : cacheError);
    }
    void audit("ORGANIZATION_PROFILE_UPDATED", "Organization", org.id, req.auth!.userId, org.id).catch((auditError) => {
      console.warn("[SUPPLIER PROFILE] Audit log could not be saved:", auditError instanceof Error ? auditError.message : auditError);
    });
    emitToMarketplace("supplier:updated", { organizationId: org.id });
    emitToRole("BUYER", "supplier:updated", { organizationId: org.id });
    return sendOk(res, org);
  } catch (e) { next(e); }
}

export async function listBusinessMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.query.organizationId || "");
    if (!organizationId) throw new AppError(400, "Organization ID is required");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    const items = await prisma.businessMedia.findMany({
      where: { organizationId },
      orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return sendOk(res, items);
  } catch (e) { next(e); }
}

export async function createBusinessMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      organizationId: z.string().min(1),
      mediaType: z.enum(["COMPANY_LOGO", "COVER_PHOTO", "COMPANY_PHOTO", "FACTORY_PHOTO", "WORK_PROCESS"]),
      url: z.string().url().max(2000),
      fileName: z.string().max(255).optional(),
    }).parse(req.body);
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");

    const result = await prisma.$transaction(async tx => {
      if (input.mediaType === "COMPANY_LOGO" || input.mediaType === "COVER_PHOTO") {
        await tx.businessMedia.deleteMany({ where: { organizationId: input.organizationId, mediaType: input.mediaType } });
      } else {
        const count = await tx.businessMedia.count({ where: { organizationId: input.organizationId, mediaType: input.mediaType } });
        const limit = input.mediaType === "COMPANY_PHOTO" ? 10 : 20;
        if (count >= limit) throw new AppError(400, `Maximum ${limit} images allowed for this gallery.`);
      }
      return tx.businessMedia.create({
        data: {
          organizationId: input.organizationId,
          mediaType: input.mediaType,
          url: input.url,
          fileName: input.fileName || null,
          sortOrder: await tx.businessMedia.count({ where: { organizationId: input.organizationId, mediaType: input.mediaType } })
        }
      });
    });
    await audit("BUSINESS_MEDIA_ADDED", "BusinessMedia", result.id, req.auth!.userId, input.organizationId, { mediaType: input.mediaType });
    await invalidateCachePattern("cache:suppliers:");
    emitToMarketplace("supplier:updated", { organizationId: input.organizationId });
    emitToRole("BUYER", "supplier:updated", { organizationId: input.organizationId });
    return sendOk(res, result, 201);
  } catch (e) { next(e); }
}

export async function deleteBusinessMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const mediaId = String(req.params.mediaId || "");
    const media = await prisma.businessMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new AppError(404, "Gallery image not found");
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: media.organizationId, role: "SUPPLIER", isActive: true },
      select: { id: true }
    });
    if (!membership) throw new AppError(403, "Active supplier membership required");
    await prisma.businessMedia.delete({ where: { id: mediaId } });
    await audit("BUSINESS_MEDIA_DELETED", "BusinessMedia", mediaId, req.auth!.userId, media.organizationId, { mediaType: media.mediaType });
    await invalidateCachePattern("cache:suppliers:");
    emitToMarketplace("supplier:updated", { organizationId: media.organizationId });
    emitToRole("BUYER", "supplier:updated", { organizationId: media.organizationId });
    return sendOk(res, { deleted: true, id: mediaId });
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
    emitToRole("ADMIN", "quotation:created", { rfqId: quote.rfqId, quotationId: quote.id });
    return sendOk(res, quote, 201);
  } catch (e) { next(e); }
}

export async function reviseSupplierQuotation(req: Request, res: Response, next: NextFunction) {
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

    const quotationId = Array.isArray(req.params.quotationId) ? req.params.quotationId[0] : req.params.quotationId;
    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) throw new AppError(404, "Quotation not found");
    if (quotation.rfqId !== input.rfqId || quotation.supplierOrgId !== input.supplierOrgId) {
      throw new AppError(400, "Quotation details do not match the selected RFQ and supplier");
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: input.supplierOrgId, role: "SUPPLIER", isActive: true }
    });
    if (!member) throw new AppError(403, "Active supplier membership required");
    if (quotation.status !== "SUBMITTED" && quotation.status !== "REVISED") {
      throw new AppError(400, "Only submitted quotations can be revised");
    }

    const rfq = await prisma.rfq.findUnique({ where: { id: input.rfqId } });
    if (!rfq || rfq.status !== "OPEN") throw new AppError(400, "This RFQ is no longer open for quotation revisions");

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        totalAmount: input.totalAmount,
        currency: input.currency,
        leadTimeDays: input.leadTimeDays,
        sampleCost: input.sampleCost,
        sampleLeadDays: input.sampleLeadDays,
        moq: input.moq,
        validityUntil: input.validityUntil,
        terms: input.terms,
        status: "REVISED",
        revision: { increment: 1 },
        items: {
          deleteMany: {},
          create: input.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            rfqItemId: item.rfqItemId
          }))
        }
      },
      include: { items: true }
    });

    emitToOrg(quotation.buyerOrgId, "quotation:updated", { rfqId: quotation.rfqId, quotationId, status: "REVISED" });
    emitToRole("BUYER", "quotation:updated", { rfqId: quotation.rfqId, quotationId, status: "REVISED" });
    emitToRole("ADMIN", "quotation:updated", { rfqId: quotation.rfqId, quotationId, status: "REVISED" });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function updateQuotationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      status: z.enum(["SUBMITTED", "ACCEPTED", "REJECTED", "WITHDRAWN"]),
      reason: z.string().max(1000).optional(),
    }).parse(req.body);

    const quotationId = Array.isArray(req.params.quotationId) ? req.params.quotationId[0] : req.params.quotationId;
    const quote = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        rfq: { select: { id: true, title: true, buyerOrgId: true } },
        supplier: { select: { id: true, name: true } },
      }
    });
    if (!quote) throw new AppError(404, "Quotation not found");

    const buyer = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: quote.buyerOrgId, role: "BUYER", isActive: true }
    });
    const supplier = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: quote.supplierOrgId, role: "SUPPLIER", isActive: true }
    });
    if (!buyer && !supplier) throw new AppError(403, "Membership required");

    if (input.status === "REJECTED" && !buyer) {
      throw new AppError(403, "Only the buyer can reject a quotation");
    }
    if (input.status === "WITHDRAWN" && !supplier) {
      throw new AppError(403, "Only the supplier can withdraw a quotation");
    }

    const updated = await prisma.quotation.update({
      where: { id: quote.id },
      data: { status: input.status },
      include: {
        items: true,
        supplier: { select: { id: true, name: true, city: true } }
      }
    });

    emitToOrg(quote.buyerOrgId, "quotation:updated", { quotationId: quote.id, status: input.status });
    emitToOrg(quote.supplierOrgId, "quotation:updated", { quotationId: quote.id, status: input.status });
    emitToRole("ADMIN", "quotation:updated", { rfqId: quote.rfqId, quotationId: quote.id, status: input.status });

    return sendOk(res, updated);
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
        samples: true,
        qcReports: { orderBy: { submittedAt: "desc" } }
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
        qcReports: { orderBy: { submittedAt: "desc" } },
        events: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!order) throw new AppError(404, "Order not found");
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.auth!.userId,
        isActive: true,
        organizationId: { in: [order.buyerOrgId, order.supplierOrgId] }
      }
    });
    if (!membership && req.auth!.role !== "ADMIN") throw new AppError(403, "Order membership required");
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
                  { title: "Production Payment", sequence: 1, percentage: 0, amount: 0, status: "UPCOMING" },
                  { title: "Final Payment", sequence: 2, percentage: 100, amount: quote.totalAmount, status: "UPCOMING" }
                ]
              }
            }
          },
          samples: {
            create: {
              status: "REQUESTED",
              notes: JSON.stringify({
                description: `Pre-Production (PP) Sample for ${quote.items[0]?.description || garmentTitle}`,
                samplePrice: Number(quote.sampleCost || 0) > 0 ? Number(quote.sampleCost) : undefined,
                samplePriceCurrency: quote.currency,
                sampleLeadDays: quote.sampleLeadDays ?? undefined
              })
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
    emitToRole("ADMIN", "quotation:updated", { rfqId: quote.rfqId, quotationId: quote.id, status: "ACCEPTED" });
    emitToRole("ADMIN", "rfq:updated", { rfqId: quote.rfqId, status: "AWARDED" });
    emitToRole("ADMIN", "order:created", { orderId: order.id, poNumber: order.poNumber });
    return sendOk(res, order, 201);
  } catch (e) { next(e); }
}

export async function requestDeliveryAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = String(req.params.orderId || "");
    const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, "Purchase order not found");
    const supplier = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true }
    });
    if (!supplier) throw new AppError(403, "Only the assigned supplier can request the delivery address");
    if (order.status !== "READY_TO_DISPATCH") throw new AppError(409, "Delivery address can only be requested after buyer approves the quality check.");
    if (order.deliveryAddressStatus === "CONFIRMED") throw new AppError(409, "Buyer delivery address has already been submitted.");
    if (order.deliveryAddressStatus === "REQUESTED") return sendOk(res, order);

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { deliveryAddressStatus: "REQUESTED", deliveryAddressRequestedAt: new Date() }
      });
      await tx.orderEvent.create({
        data: { purchaseOrderId: order.id, eventType: "DELIVERY_ADDRESS_REQUESTED", note: "Supplier requested the buyer to provide the delivery address.", actorUserId: req.auth!.userId }
      });
      const buyers = await tx.organizationMember.findMany({
        where: { organizationId: order.buyerOrgId, role: "BUYER", isActive: true }, select: { userId: true }
      });
      if (buyers.length) {
        await tx.notification.createMany({
          data: buyers.map(member => ({
            userId: member.userId,
            title: "Delivery address required",
            body: `Your supplier is ready to dispatch PO #${order.poNumber}. Please submit the delivery address so the shipment can be dispatched.`
          }))
        });
      }
      buyers.forEach(member => emitToUser(member.userId, "notification:new", { orderId: order.id, title: "Delivery address required" }));
      return result;
    });
    await audit("DELIVERY_ADDRESS_REQUESTED", "PurchaseOrder", order.id, req.auth!.userId, order.supplierOrgId);
    emitToOrg(order.buyerOrgId, "order:updated", { orderId: order.id, deliveryAddressStatus: "REQUESTED" });
    emitToOrg(order.supplierOrgId, "order:updated", { orderId: order.id, deliveryAddressStatus: "REQUESTED" });
    emitToRole("ADMIN", "order:updated", { orderId: order.id, deliveryAddressStatus: "REQUESTED" });
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function submitDeliveryAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      recipientName: z.string().trim().min(2).max(160),
      phone: z.string().trim().min(7).max(30),
      addressLine: z.string().trim().min(3).max(2000),
      city: z.string().trim().min(2).max(120),
      state: z.string().trim().min(2).max(120),
      postalCode: z.string().trim().min(3).max(20),
      country: z.string().trim().min(2).max(100),
      latitude: z.number().min(-90).max(90).optional().nullable(),
      longitude: z.number().min(-180).max(180).optional().nullable()
    }).parse(req.body);
    const orderId = String(req.params.orderId || "");
    const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, "Purchase order not found");
    const buyer = await prisma.organizationMember.findFirst({
      where: { userId: req.auth!.userId, organizationId: order.buyerOrgId, role: "BUYER", isActive: true }
    });
    if (!buyer) throw new AppError(403, "Only the buyer organization can submit the delivery address");
    if (order.status !== "READY_TO_DISPATCH") throw new AppError(409, "Delivery address can only be submitted when the order is ready to dispatch.");
    if (order.deliveryAddressStatus !== "REQUESTED" && order.deliveryAddressStatus !== "CONFIRMED") {
      throw new AppError(409, "The supplier has not requested the delivery address yet.");
    }
    if (order.dispatchDate) throw new AppError(409, "Delivery address is locked after dispatch.");

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          deliveryAddressStatus: "CONFIRMED",
          deliveryRecipientName: input.recipientName,
          deliveryPhone: input.phone,
          deliveryAddressLine: input.addressLine,
          deliveryCity: input.city,
          deliveryState: input.state,
          deliveryPostalCode: input.postalCode,
          deliveryCountry: input.country,
          deliveryLatitude: input.latitude ?? null,
          deliveryLongitude: input.longitude ?? null,
          deliveryAddressSubmittedAt: new Date()
        }
      });
      await tx.orderEvent.create({
        data: { purchaseOrderId: order.id, eventType: "DELIVERY_ADDRESS_CONFIRMED", note: "Buyer submitted and confirmed the delivery address.", actorUserId: req.auth!.userId }
      });
      const suppliers = await tx.organizationMember.findMany({
        where: { organizationId: order.supplierOrgId, role: "SUPPLIER", isActive: true }, select: { userId: true }
      });
      if (suppliers.length) {
        await tx.notification.createMany({
          data: suppliers.map(member => ({
            userId: member.userId,
            title: "Buyer delivery address received",
            body: `Buyer has submitted the delivery address for PO #${order.poNumber}. Review the address and proceed with dispatch.`
          }))
        });
      }
      suppliers.forEach(member => emitToUser(member.userId, "notification:new", { orderId: order.id, title: "Buyer delivery address received" }));
      return result;
    });
    await audit("DELIVERY_ADDRESS_CONFIRMED", "PurchaseOrder", order.id, req.auth!.userId, order.buyerOrgId);
    emitToOrg(order.buyerOrgId, "order:updated", { orderId: order.id, deliveryAddressStatus: "CONFIRMED" });
    emitToOrg(order.supplierOrgId, "order:updated", { orderId: order.id, deliveryAddressStatus: "CONFIRMED" });
    emitToRole("ADMIN", "order:updated", { orderId: order.id, deliveryAddressStatus: "CONFIRMED" });
    return sendOk(res, updated);
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

    const supplierStatuses = ["ACCEPTED", "SAMPLE_PENDING", "PRODUCTION_STARTED", "IN_PRODUCTION", "QC_PENDING", "QC", "DISPATCHED"];
    const buyerStatuses = ["SAMPLE_APPROVED", "IN_PRODUCTION", "READY_TO_DISPATCH", "DELIVERED", "COMPLETED"];
    if (supplier && !buyer && !supplierStatuses.includes(input.status) && input.status !== "CANCELLED") {
      throw new AppError(403, "This order status can only be updated by the buyer");
    }
    if (buyer && !supplier && !buyerStatuses.includes(input.status) && input.status !== "CANCELLED") {
      throw new AppError(403, "This order status can only be updated by the supplier");
    }
    if (input.status === "ACCEPTED" && !supplier) {
      throw new AppError(403, "Only the supplier can accept the purchase order");
    }
    if (supplier && input.status === "SAMPLE_PENDING") {
      const sampleRecords = await prisma.sample.findMany({ where: { purchaseOrderId: order.id }, select: { notes: true } });
      const paidSampleExists = sampleRecords.some(sample => {
        try { return JSON.parse(sample.notes || "{}").samplePaymentStatus === "PAID"; } catch { return false; }
      });
      if (!paidSampleExists) throw new AppError(409, "Buyer must pay the sample price before the supplier can dispatch the PP sample.");
    }
    if (supplier && input.status === "PRODUCTION_STARTED") {
      const plan = await prisma.paymentPlan.findUnique({ where: { purchaseOrderId: order.id }, include: { milestones: true } });
      const productionPayment = plan?.milestones.find(item => item.title === "Production Payment");
      if (productionPayment?.status !== "PAID") throw new AppError(409, "Buyer production payment must be successful before bulk production can start.");
    }
    if (supplier && input.status === "QC_PENDING") {
      throw new AppError(409, "Submit the detailed QC report using the quality-check submission form.");
    }
    if (buyer && ["READY_TO_DISPATCH", "IN_PRODUCTION"].includes(input.status) && ["QC_PENDING", "QC"].includes(order.status)) {
      throw new AppError(409, "Please review the submitted QC report using the QC review action.");
    }
    if (buyer && input.status === "READY_TO_DISPATCH" && !["QC_PENDING", "QC"].includes(order.status)) {
      throw new AppError(409, "Supplier must submit the quality inspection before buyer approval.");
    }
    if (buyer && input.status === "IN_PRODUCTION" && !["QC_PENDING", "QC"].includes(order.status)) {
      throw new AppError(409, "There is no pending quality inspection to reject.");
    }
    if (supplier && input.status === "DISPATCHED" && order.status !== "READY_TO_DISPATCH") {
      throw new AppError(409, "Buyer must approve the quality check before dispatch.");
    }
    if (supplier && input.status === "DISPATCHED" && order.deliveryAddressStatus !== "CONFIRMED") {
      throw new AppError(409, "Buyer delivery address is required before dispatch. Request the address from the buyer first.");
    }

    const updated = await prisma.$transaction(async tx => {
      const updateData: any = { status: input.status };
      if (input.trackingNumber) updateData.trackingNumber = input.trackingNumber;
      if (input.qcNotes) updateData.qcNotes = input.qcNotes;
      if (input.status === "DISPATCHED") updateData.dispatchDate = new Date();
      if (input.status === "DELIVERED" || input.status === "COMPLETED") updateData.deliveryDate = new Date();

      let result: any;
      if (supplier && input.status === "DISPATCHED") {
        const guarded = await tx.purchaseOrder.updateMany({
          where: { id: order.id, status: "READY_TO_DISPATCH", deliveryAddressStatus: "CONFIRMED" },
          data: updateData
        });
        if (guarded.count !== 1) throw new AppError(409, "The buyer delivery address must be confirmed before dispatch.");
        result = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: order.id } });
      } else {
        result = await tx.purchaseOrder.update({ where: { id: order.id }, data: updateData });
      }

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

    if (input.status === "DISPATCHED") {
      const [plan, stages] = await Promise.all([
        prisma.paymentPlan.findUnique({ where: { purchaseOrderId: order.id }, include: { milestones: true } }),
        prisma.orderMilestone.findMany({ where: { purchaseOrderId: order.id } })
      ]);
      const production = plan?.milestones.find(item => item.title === "Production Payment");
      const finalPayment = plan?.milestones.find(item => item.title === "Final Payment");
      const qcComplete = ["READY_TO_DISPATCH", "QC"].includes(order.status) || stages.some(item => /quality|qc/i.test(item.title) && item.status === "COMPLETED");
      if (qcComplete && production?.status === "PAID" && finalPayment?.status === "UPCOMING") {
        await prisma.paymentMilestone.update({ where: { id: finalPayment.id }, data: { status: "DUE" } });
        const buyerMembers = await prisma.organizationMember.findMany({ where: { organizationId: order.buyerOrgId, role: "BUYER", isActive: true }, select: { userId: true } });
        if (buyerMembers.length) {
          await prisma.notification.createMany({ data: buyerMembers.map(member => ({ userId: member.userId, title: "Final payment due", body: `QC and dispatch are complete for PO #${order.poNumber}. The remaining balance is now due.` })) });
          buyerMembers.forEach(member => emitToUser(member.userId, "notification:new", { orderId: order.id, title: "Final payment due" }));
        }
        emitToOrg(order.buyerOrgId, "payment:updated", { orderId: order.id, milestoneId: finalPayment.id, status: "DUE", stage: "FINAL" });
        emitToOrg(order.supplierOrgId, "payment:updated", { orderId: order.id, milestoneId: finalPayment.id, status: "DUE", stage: "FINAL" });
      }
    }
    if (input.status !== "ACCEPTED") {
      const recipientOrgId = supplier ? order.buyerOrgId : order.supplierOrgId;
      const recipientRole = supplier ? "BUYER" : "SUPPLIER";
      const recipients = await prisma.organizationMember.findMany({ where: { organizationId: recipientOrgId, role: recipientRole, isActive: true }, select: { userId: true } });
      const titleByStatus: Record<string, string> = {
        SAMPLE_APPROVED: "Sample approved", PRODUCTION_STARTED: "Production started", IN_PRODUCTION: "Production progress updated",
        QC_PENDING: "Quality check started", QC: "Quality check updated", READY_TO_DISPATCH: "Order ready to dispatch",
        DISPATCHED: "Order dispatched", DELIVERED: "Order delivered", COMPLETED: "Order completed", CANCELLED: "Order cancelled"
      };
      const title = titleByStatus[input.status] || "Order status updated";
      const body = `PO #${order.poNumber} status changed to ${input.status.replaceAll("_", " ")}${input.trackingNumber ? `. Tracking number: ${input.trackingNumber}` : ""}${input.note ? `. ${input.note}` : ""}`;
      if (recipients.length) {
        await prisma.notification.createMany({ data: recipients.map(member => ({ userId: member.userId, title, body })) });
        recipients.forEach(member => emitToUser(member.userId, "notification:new", { orderId: order.id, status: input.status, title }));
      }
    }

    await audit("ORDER_STATUS_UPDATED", "PurchaseOrder", order.id, req.auth!.userId, supplier ? order.supplierOrgId : order.buyerOrgId);
    emitToOrg(order.buyerOrgId, "order:updated", { orderId: order.id, status: input.status });
    emitToOrg(order.supplierOrgId, "order:updated", { orderId: order.id, status: input.status });
    emitToRole("ADMIN", "order:updated", { orderId: order.id, status: input.status });
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
        supplierPaymentProfile: { select: { status: true, kycStatus: true, settlementStatus: true } },
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