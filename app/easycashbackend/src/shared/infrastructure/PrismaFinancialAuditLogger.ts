import { Prisma } from '@prisma/client';
import { resolveClient } from './PrismaUnitOfWork';
import type { TransactionContext } from '../application/TransactionContext';
import type { AuditLogEntry, IFinancialAuditLogger } from '../application/ports/IFinancialAuditLogger';

/**
 * `docs/Architecture/ADR-047-financial-audit-isolation.md`: writes to the same
 * `audit_logs` table identity's `PrismaAuditLogger` uses — no new table.
 *
 * Deliberately does NOT catch its own errors, unlike
 * `modules/identity/infrastructure/PrismaAuditLogger.ts` — this is the
 * entire mechanical difference that makes fail-closed behavior possible.
 * Always resolves the write through `resolveClient(ctx)`, exactly as every
 * other Prisma-backed repository does, so this write joins the caller's
 * `IUnitOfWork.run()` transaction when a `ctx` is supplied: if this insert
 * fails, the whole transaction — including whatever financial state change
 * it accompanies — rolls back with it.
 */
export class PrismaFinancialAuditLogger implements IFinancialAuditLogger {
  async log(entry: AuditLogEntry, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.auditLog.create({
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
