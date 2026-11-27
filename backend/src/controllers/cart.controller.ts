import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError, sendOk } from "../utils/http";
import { audit } from "../services/audit";
import { emitToOrg } from "../services/realtime";

async function requireBuyerMembership(userId: string, buyerOrgId: string) {
  const member = await prisma.organizationMember.findFirst({
    where: { userId, organizationId: buyerOrgId, role: "BUYER", isActive: true },
    select: { id: true }
  });
  if (!member) throw new AppError(403, "Active buyer organization membership required");
}

const cartInclude = {
  catalogItem: {
    include: {
      images: { orderBy: { sortOrder: "asc" as const } },
      priceTiers: { orderBy: { minQuantity: "asc" as const } },
      supplierProfile: {
        include: {
          organization: { select: { id: true, name: true, city: true, country: true, verificationStatus: true } }
        }
      }
    }
  }
};

export async function getBuyerCart(req: Request, res: Response, next: NextFunction) {
  try {
    const buyerOrgId = String(req.query.organizationId || "");
    if (!buyerOrgId) throw new AppError(400, "Buyer organization ID is required");
    await requireBuyerMembership(req.auth!.userId, buyerOrgId);
    const items = await prisma.cartItem.findMany({
      where: { buyerOrgId },
      include: cartInclude,
      orderBy: { createdAt: "asc" }
    });
    return sendOk(res, { items, itemCount: items.length, totalQuantity: items.reduce((sum, row) => sum + row.quantity, 0) });
  } catch (error) { next(error); }
}

export async function addBuyerCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      buyerOrgId: z.string().min(1),
      catalogItemId: z.string().min(1),
      quantity: z.coerce.number().int().positive().max(100000).optional()
    }).parse(req.body);
    await requireBuyerMembership(req.auth!.userId, input.buyerOrgId);
    const product = await prisma.catalogItem.findFirst({
      where: {
        id: input.catalogItemId,
        isActive: true,
        supplierProfile: { organization: { verificationStatus: "APPROVED", members: { some: { role: "SUPPLIER", isActive: true } } } }
      },
      include: { supplierProfile: { select: { organizationId: true } } }
    });
    if (!product) throw new AppError(404, "This product is no longer available in the marketplace");
    const quantity = input.quantity ?? Math.max(product.moq || 1, 1);
    if (product.moq && quantity < product.moq) throw new AppError(400, `Minimum order quantity is ${product.moq} pcs`);
    const item = await prisma.cartItem.upsert({
      where: { buyerOrgId_catalogItemId: { buyerOrgId: input.buyerOrgId, catalogItemId: input.catalogItemId } },
      create: { buyerOrgId: input.buyerOrgId, catalogItemId: input.catalogItemId, quantity },
      update: {},
      include: cartInclude
    });
    if (product.moq && item.quantity < product.moq) throw new AppError(400, `Minimum order quantity is ${product.moq} pcs`);
    return sendOk(res, item, 201);
  } catch (error) { next(error); }
}

export async function updateBuyerCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      buyerOrgId: z.string().min(1),
      quantity: z.coerce.number().int().positive().max(100000)
    }).parse(req.body);
    await requireBuyerMembership(req.auth!.userId, input.buyerOrgId);
    const existing = await prisma.cartItem.findFirst({
      where: { id: String(req.params.cartItemId), buyerOrgId: input.buyerOrgId },
      include: { catalogItem: true }
    });
    if (!existing) throw new AppError(404, "Cart item not found");
    if (existing.catalogItem.moq && input.quantity < existing.catalogItem.moq) {
      throw new AppError(400, `Minimum order quantity is ${existing.catalogItem.moq} pcs`);
    }
    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: input.quantity },
      include: cartInclude
    });
    return sendOk(res, updated);
  } catch (error) { next(error); }
}

export async function removeBuyerCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const buyerOrgId = String(req.query.organizationId || req.body?.buyerOrgId || "");
    if (!buyerOrgId) throw new AppError(400, "Buyer organization ID is required");
    await requireBuyerMembership(req.auth!.userId, buyerOrgId);
    const result = await prisma.cartItem.deleteMany({
      where: { id: String(req.params.cartItemId), buyerOrgId }
    });
    if (!result.count) throw new AppError(404, "Cart item not found");
    return sendOk(res, { removed: true });
  } catch (error) { next(error); }
}

export async function clearBuyerCart(req: Request, res: Response, next: NextFunction) {
  try {
    const buyerOrgId = String(req.query.organizationId || req.body?.buyerOrgId || "");
    if (!buyerOrgId) throw new AppError(400, "Buyer organization ID is required");
    await requireBuyerMembership(req.auth!.userId, buyerOrgId);
    const result = await prisma.cartItem.deleteMany({ where: { buyerOrgId } });
    return sendOk(res, { cleared: true, removedCount: result.count });
  } catch (error) { next(error); }
}

export async function submitCartAsRfq(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.object({
      buyerOrgId: z.string().min(1),
      deliveryLocation: z.string().trim().min(3).max(1000),
      targetDate: z.coerce.date().optional(),
      targetPrice: z.coerce.number().positive().optional(),
      instructions: z.string().trim().max(4000).optional(),
      items: z.array(z.object({
        cartItemId: z.string().min(1),
        quantity: z.coerce.number().int().positive().max(100000),
        specifications: z.string().trim().max(3000).optional()
      })).min(1).max(100)
    }).parse(req.body);
    await requireBuyerMembership(req.auth!.userId, input.buyerOrgId);
    const ids = input.items.map(item => item.cartItemId);
    if (new Set(ids).size !== ids.length) throw new AppError(400, "Duplicate cart items are not allowed");

    const cartRows = await prisma.cartItem.findMany({
      where: { buyerOrgId: input.buyerOrgId, id: { in: ids } },
      include: cartInclude
    });
    if (cartRows.length !== input.items.length) throw new AppError(409, "Some selected cart items are no longer available. Refresh your cart.");

    const submittedItems = input.items.map(line => {
      const cartRow = cartRows.find(row => row.id === line.cartItemId)!;
      const product = cartRow.catalogItem;
      const supplier = product.supplierProfile.organization;
      if (!product.isActive || supplier.verificationStatus !== "APPROVED") {
        throw new AppError(409, `${product.name} is no longer available from its supplier`);
      }
      if (product.moq && line.quantity < product.moq) {
        throw new AppError(400, `${product.name}: minimum order quantity is ${product.moq} pcs`);
      }
      return { cartRow, product, supplier, quantity: line.quantity, specifications: line.specifications || "" };
    });

    const grouped = new Map<string, typeof submittedItems>();
    for (const item of submittedItems) {
      const rows = grouped.get(item.supplier.id) || [];
      rows.push(item);
      grouped.set(item.supplier.id, rows);
    }

    const result = await prisma.$transaction(async tx => {
      const group = await tx.rfqSubmissionGroup.create({
        data: {
          buyerOrgId: input.buyerOrgId,
          deliveryLocation: input.deliveryLocation,
          targetDate: input.targetDate,
          targetPrice: input.targetPrice,
          instructions: input.instructions
        }
      });
      const createdRfqs = [];
      for (const [supplierOrgId, rows] of grouped.entries()) {
        const names = rows.map(row => row.product.name);
        const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
        const rfq = await tx.rfq.create({
          data: {
            buyerOrgId: input.buyerOrgId,
            submissionGroupId: group.id,
            title: rows.length === 1 ? `RFQ - ${names[0]}` : `RFQ - ${rows.length} Products`,
            description: [
              input.instructions,
              `Delivery location: ${input.deliveryLocation}`,
              input.targetDate ? `Required delivery date: ${input.targetDate.toISOString().slice(0, 10)}` : null,
              input.targetPrice ? `Target price: ₹${input.targetPrice} per unit (indicative)` : null
            ].filter(Boolean).join("\\n"),
            garmentType: [...new Set(rows.map(row => row.product.itemType))].join(", "),
            fabricSpec: rows.map(row => `${row.product.name}: ${[row.product.material, row.product.gsm ? `${row.product.gsm} GSM` : null].filter(Boolean).join(", ") || "See product specifications"}`).join("; "),
            targetPrice: input.targetPrice,
            targetQuantity: totalQuantity,
            targetDate: input.targetDate,
            status: "OPEN",
            items: {
              create: rows.map(row => ({
                catalogItemId: row.product.id,
                name: row.product.name,
                description: row.product.description || row.product.itemType,
                specifications: [
                  `Category: ${row.product.itemType}`,
                  row.product.material ? `Material: ${row.product.material}` : null,
                  row.product.gsm ? `GSM: ${row.product.gsm}` : null,
                  row.product.sizes ? `Sizes: ${row.product.sizes}` : null,
                  row.product.colors ? `Colours: ${row.product.colors}` : null,
                  row.specifications ? `Buyer requirements: ${row.specifications}` : null
                ].filter(Boolean).join("\\n"),
                quantity: row.quantity,
                unit: "pieces"
              }))
            },
            invitations: { create: { supplierOrgId, status: "INVITED" } }
          },
          include: {
            items: true,
            invitations: true,
            buyer: { select: { id: true, name: true } }
          }
        });
        createdRfqs.push(rfq);
        const supplierMembers = await tx.organizationMember.findMany({
          where: { organizationId: supplierOrgId, role: "SUPPLIER", isActive: true },
          select: { userId: true }
        });
        if (supplierMembers.length) {
          await tx.notification.createMany({
            data: supplierMembers.map(member => ({
              userId: member.userId,
              title: "New RFQ received",
              body: `You have received a new RFQ for ${names.join(", ")}. Please review the buyer's quantities and requirements.`
            }))
          });
        }
      }
      await tx.cartItem.deleteMany({ where: { buyerOrgId: input.buyerOrgId, id: { in: ids } } });
      return { group, rfqs: createdRfqs };
    });

    await audit("RFQ_CART_SUBMITTED", "RfqSubmissionGroup", result.group.id, req.auth!.userId, input.buyerOrgId);
    for (const rfq of result.rfqs) {
      const supplierId = rfq.invitations[0]?.supplierOrgId;
      if (supplierId) emitToOrg(supplierId, "rfq:created", { rfqId: rfq.id, submissionGroupId: result.group.id, title: rfq.title });
    }
    emitToOrg(input.buyerOrgId, "rfq:cart-submitted", { submissionGroupId: result.group.id, rfqIds: result.rfqs.map(rfq => rfq.id) });
    return sendOk(res, {
      submissionGroupId: result.group.id,
      rfqCount: result.rfqs.length,
      supplierCount: result.rfqs.length,
      rfqs: result.rfqs
    }, 201);
  } catch (error) { next(error); }
}
