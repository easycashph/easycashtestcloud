import { prisma } from '@shared/database/prismaClient';
import type { AuditLogRecord, FindManyAuditLogsOptions, IAuditLogRepository } from '../application/ports/IAuditLogRepository';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  /** Mirrors PrismaLoanApplicationRepository.findMany: cursor pagination, newest first. No branch dimension — see IAuditLogRepository doc. */
  async findMany(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]> {
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      user: row.user,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      previousValue: row.previousValue,
      newValue: row.newValue,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));
  }
}
