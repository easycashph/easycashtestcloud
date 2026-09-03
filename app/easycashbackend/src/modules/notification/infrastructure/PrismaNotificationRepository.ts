import type { Notification as PrismaNotificationRow } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { overdueCutoff } from '@shared/utils/dueDateGrace';
import type {
  FindManyNotificationsOptions,
  INotificationRepository,
  LoanAccountNotificationTarget,
} from '../application/ports/INotificationRepository';
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
  async findOverdueLoanAccounts(asOf: Date): Promise<LoanAccountNotificationTarget[]> {
    return prisma.$queryRaw<LoanAccountNotificationTarget[]>(Prisma.sql`
      SELECT DISTINCT la.id, la."branchId", la."loanCode", (b."firstName" || ' ' || b."lastName") AS "borrowerName"
      FROM repayment_schedules rs
      JOIN loan_accounts la ON la.id = rs."loanAccountId"
      JOIN borrowers b ON b.id = la."borrowerId"
      WHERE rs."dueDate" < ${asOf}
        AND (rs."principalPaid" + rs."interestPaid" + rs."feesPaid" + rs."penaltyPaid")
            < (rs."principalDue" + rs."interestDue" + rs."feesDue" + rs."penaltyDue")
        AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
    `);
  }

  /** Same live "matured" definition as `PrismaLoanAccountRepository.findMaturedLoanAccountIds`
   * (per-loan-id filter version, used by `isMatured` on the Loan Account API) - scan-ALL here
   * instead, for the daily LOAN_MATURED notification job. A loan is matured when it has at least
   * one overdue+unpaid installment AND its own maturity date (the last installment's dueDate) has
   * itself already fully elapsed, both through the same `overdueCutoff()` grace-through-the-
   * full-calendar-day rule. Deliberately duplicated, not shared, same reasoning as
   * `findOverdueLoanAccounts` above's own doc comment. */
  async findMaturedLoanAccounts(asOf: Date): Promise<LoanAccountNotificationTarget[]> {
    const cutoff = overdueCutoff(asOf);
    return prisma.$queryRaw<LoanAccountNotificationTarget[]>(Prisma.sql`
      WITH overdue AS (
        SELECT DISTINCT rs."loanAccountId" AS id
        FROM repayment_schedules rs
        JOIN loan_accounts la ON la.id = rs."loanAccountId"
        WHERE rs."dueDate" < ${cutoff}
          AND (rs."principalPaid" + rs."interestPaid" + rs."feesPaid" + rs."penaltyPaid")
              < (rs."principalDue" + rs."interestDue" + rs."feesDue" + rs."penaltyDue")
          AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
      ),
      maturity AS (
        SELECT "loanAccountId" AS id, MAX("dueDate") AS maturity_date
        FROM repayment_schedules
        GROUP BY "loanAccountId"
      )
      SELECT DISTINCT la.id, la."branchId", la."loanCode", (b."firstName" || ' ' || b."lastName") AS "borrowerName"
      FROM overdue
      JOIN maturity ON maturity.id = overdue.id
      JOIN loan_accounts la ON la.id = overdue.id
      JOIN borrowers b ON b.id = la."borrowerId"
      WHERE maturity.maturity_date < ${cutoff}
    `);
  }

  /** Installment #1 of an ACTIVE/ACTIVE_IN_ARREARS loan whose `dueDate` falls within
   * [dayStart, dayEnd) - same "always installment #1, optionally date-filtered on its own due
   * date" definition `getFirstAmortizationReport` already uses, narrowed to exactly today's Asia/
   * Manila calendar day for the daily LOAN_FIRST_AMORTIZATION_DUE_TODAY notification job. */
  async findFirstAmortizationDueTodayLoanAccounts(dayStart: Date, dayEnd: Date): Promise<LoanAccountNotificationTarget[]> {
    return prisma.$queryRaw<LoanAccountNotificationTarget[]>(Prisma.sql`
      SELECT la.id, la."branchId", la."loanCode", (b."firstName" || ' ' || b."lastName") AS "borrowerName"
      FROM repayment_schedules rs
      JOIN loan_accounts la ON la.id = rs."loanAccountId"
      JOIN borrowers b ON b.id = la."borrowerId"
      WHERE rs."installmentNumber" = 1
        AND rs."dueDate" >= ${dayStart} AND rs."dueDate" < ${dayEnd}
        AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
    `);
  }
}
