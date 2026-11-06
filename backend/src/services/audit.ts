import { prisma } from "../config/prisma";
export async function audit(action: string, entityType: string, entityId?: string, actorUserId?: string, organizationId?: string, metadata?: object) {
  await prisma.auditLog.create({ data: { action, entityType, entityId, actorUserId, organizationId, metadata } });
}