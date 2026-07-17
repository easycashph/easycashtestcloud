import type { Notification as PrismaNotificationRow } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { FindManyNotificationsOptions, INotificationRepository } from '../application/ports/INotificationRepository';
import { Notification, type NotificationType } from '../domain/Notification';

function toDomain(row: PrismaNotificationRow): Notification {
  return Notification.reconstitute({
    id: row.id,
    recipientUserId: row.recipientUserId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    branchId: row.branchId,
    read: row.read,
    readAt: row.readAt,
    createdAt: row.createdAt,
  });
}

export class PrismaNotificationRepository implements INotificationRepository {
  async create(notification: Notification): Promise<void> {
    await prisma.notification.create({
      data: {
        id: notification.id,
        recipientUserId: notification.recipientUserId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        branchId: notification.branchId,
        read: notification.read,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** Mirrors PrismaAuditLogRepository.findMany: cursor pagination, newest first. */
  async findMany(options: FindManyNotificationsOptions): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: {
        recipientUserId: options.recipientUserId,
        ...(options.unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  async countUnread(recipientUserId: string): Promise<number> {
    return prisma.notification.count({ where: { recipientUserId, read: false } });
  }

  async markRead(id: string): Promise<void> {
    await prisma.notification.update({ where: { id }, data: { read: true, readAt: new Date() } });
  }

  async markAllRead(recipientUserId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { recipientUserId, read: false }, data: { read: true, readAt: new Date() } });
  }

  async existsRecent(type: string, entityId: string, sinceCreatedAt: Date): Promise<boolean> {
    const count = await prisma.notification.count({
      where: { type: type as NotificationType, entityId, createdAt: { gte: sinceCreatedAt } },
    });
    return count > 0;
  }

  /** Same live due-date-based definition as `PrismaDashboardRepository.findOverdueLoanAccounts` -
   * a loan is overdue if it has at least one `RepaymentSchedule` row past due with less paid than
   * owed, matching `RepaymentInstallment.status`'s own `LATE` definition. Deliberately not shared
   * code with the dashboard module (that function is module-private) - a ~15-line raw query
   * duplicated here is a smaller cost than a cross-module coupling for one query. */
  async findOverdueLoanAccounts(asOf: Date): Promise<{ id: string; branchId: string; loanCode: string }[]> {
    return prisma.$queryRaw<{ id: string; branchId: string; loanCode: string }[]>(Prisma.sql`
      SELECT DISTINCT la.id, la."branchId", la."loanCode"
      FROM repayment_schedules rs
      JOIN loan_accounts la ON la.id = rs."loanAccountId"
      WHERE rs."dueDate" < ${asOf}
        AND (rs."principalPaid" + rs."interestPaid" + rs."feesPaid" + rs."penaltyPaid")
            < (rs."principalDue" + rs."interestDue" + rs."feesDue" + rs."penaltyDue")
        AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
    `);
  }
}
