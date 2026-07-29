import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { logger } from '@shared/logger/logger';
import type { AuditLogEntry, IAuditLogger } from '../application/ports/IAuditLogger';

/**
 * AUDIT-1/AUDIT-2: append-only writes against the existing `audit_logs`
 * table.
 *
 * Audit finding H-04: fulfills IAuditLogger's "never throws" contract —
 * a failed audit write is reported via the structured logger, not
 * propagated to the caller. Without this, a transient DB error during
 * audit logging could mask the true result of a login attempt (e.g.
 * turning a correct-password rejection into an opaque 500) or, worse,
 * fail a successful login's HTTP response after its refresh token had
 * already been issued and persisted.
 */
export class PrismaAuditLogger implements IAuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
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
    } catch (error) {
      logger.error(
        { err: error, action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
        'Failed to write audit log entry — the primary operation it accompanies was NOT blocked by this failure.',
      );
    }
  }
}
