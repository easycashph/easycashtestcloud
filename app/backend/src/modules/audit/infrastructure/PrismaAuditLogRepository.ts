import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { AuditLogRecord, FindManyAuditLogsOptions, IAuditLogRepository } from '../application/ports/IAuditLogRepository';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  /** Mirrors PrismaLoanApplicationRepository.findMany: cursor pagination, newest first. No branch dimension — see IAuditLogRepository doc. */
  async findMany(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]> {
    const where: Prisma.AuditLogWhereInput = {
      ...(options.entityTypes && options.entityTypes.length > 0 ? { entityType: { in: options.entityTypes } } : {}),
      ...(options.entityId ? { entityId: options.entityId } : {}),
      ...(options.search
        ? {
            OR: [
              { action: { contains: options.search, mode: 'insensitive' } },
              { entityType: { contains: options.search, mode: 'insensitive' } },
              { entityId: { contains: options.search, mode: 'insensitive' } },
              { user: { firstName: { contains: options.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: options.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const labelsByEntityId = await resolveEntityLabels(rows);

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      user: row.user,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: labelsByEntityId.get(row.entityId) ?? null,
      previousValue: row.previousValue,
      newValue: row.newValue,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));
  }
}

/** Batch-resolves entityId -> a human-readable label, for the entityTypes that have one. Presentation-only convenience (e.g. RecentSystemActivityPanel linking to "SML-REG_00376" instead of a raw UUID) - not core domain logic, so a direct Prisma lookup here (rather than a repository per entity type) is deliberate. */
async function resolveEntityLabels(rows: { entityType: string; entityId: string }[]): Promise<Map<string, string>> {
  const loanAccountIds = [...new Set(rows.filter((r) => r.entityType === 'LoanAccount').map((r) => r.entityId))];
  const loanApplicationIds = [...new Set(rows.filter((r) => r.entityType === 'LoanApplication').map((r) => r.entityId))];

  const [loanAccounts, loanApplications] = await Promise.all([
    loanAccountIds.length > 0
      ? prisma.loanAccount.findMany({ where: { id: { in: loanAccountIds } }, select: { id: true, loanCode: true } })
      : Promise.resolve([]),
    loanApplicationIds.length > 0
      ? prisma.loanApplication.findMany({ where: { id: { in: loanApplicationIds } }, select: { id: true, applicantName: true } })
      : Promise.resolve([]),
  ]);

  const labels = new Map<string, string>();
  loanAccounts.forEach((la) => labels.set(la.id, la.loanCode));
  loanApplications.forEach((la) => labels.set(la.id, la.applicantName));
  return labels;
}
