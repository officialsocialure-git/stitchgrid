import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";

export async function supplierSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const category = typeof req.query.category === "string" && req.query.category !== "All" ? req.query.category.trim() : undefined;
    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;

    const where: any = {
      verificationStatus: { in: ["APPROVED", "PENDING"] },
    };

    if (city) {
      where.organization = { ...where.organization, city: { contains: city } };
    }

    if (category) {
      where.OR = [
        { categories: { some: { category: { contains: category } } } },
        { organization: { businessType: { contains: category } } },
      ];
    }

    if (q) {
      const searchFilter = {
        OR: [
          { organization: { name: { contains: q } } },
          { organization: { city: { contains: q } } },
          { organization: { address: { contains: q } } },
          { description: { contains: q } },
          { categories: { some: { category: { contains: q } } } },
        ]
      };
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchFilter
        ];
        delete where.OR;
      } else {
        where.OR = searchFilter.OR;
      }
    }

    const rows = await prisma.supplierProfile.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            legalName: true,
            businessType: true,
            taxId: true,
            address: true,
            city: true,
            country: true,
            verificationStatus: true,
          }
        },
        categories: true,
        catalogItems: { where: { moderationStatus: "APPROVED" } },
      },
      take: 50
    });
    return sendOk(res, rows);
  } catch (e) { next(e); }
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
    await audit("SUPPLIER_PROFILE_UPDATED", "SupplierProfile", profile.id, req.auth!.userId, input.organizationId);
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

    await audit("ORGANIZATION_PROFILE_UPDATED", "Organization", org.id, req.auth!.userId, org.id);
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
    const supplierName = quote.supplier?.name || "Supplier";
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
    return sendOk(res, updated);
  } catch (e) { next(e); }
}

export async function adminVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(2000).optional() }).parse(req.body);
    const organizationId = Array.isArray(req.params.organizationId) ? req.params.organizationId[0] : req.params.organizationId;
    const org = await prisma.organization.update({ where: { id: organizationId }, data: { verificationStatus: input.status } });
    await prisma.supplierProfile.updateMany({ where: { organizationId: org.id }, data: { verificationStatus: input.status } });
    await audit("BUSINESS_VERIFICATION", "Organization", org.id, req.auth!.userId, undefined, { status: input.status, note: input.note });
    return sendOk(res, org);
  } catch (e) { next(e); }
}

export async function listAdminOrganizations(req: Request, res: Response, next: NextFunction) {
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