import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { AuditLogEntry, IAuditLogger } from '../application/ports/IAuditLogger';

/** AUDIT-1/AUDIT-2: append-only writes against the existing `audit_logs` table. */
export class PrismaAuditLogger implements IAuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: entry.previousValue === undefined ? Prisma.JsonNull : (entry.previousValue as Prisma.InputJsonValue),
        newValue: entry.newValue === undefined ? Prisma.JsonNull : (entry.newValue as Prisma.InputJsonValue),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}
