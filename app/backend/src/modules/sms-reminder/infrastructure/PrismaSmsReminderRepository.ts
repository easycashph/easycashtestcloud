import { prisma } from '@shared/database/prismaClient';
import type {
  ISmsReminderRepository,
  LogReminderFailedInput,
  LogReminderSentInput,
  ReminderTriggerType,
  SmsReminderCandidate,
  SmsReminderLogRow,
} from '../application/ports/ISmsReminderRepository';

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Asia/Manila is fixed UTC+8 year-round (no DST), so shifting the instant by the offset before
 * reading UTC Y/M/D fields gives the correct Manila wall-clock date - then Date.UTC's own
 * month/day overflow normalization handles any month/year rollover from `targetDate` for free.
 */
function manilaDayRange(targetDate: Date): { start: Date; end: Date } {
  const manilaWallClock = new Date(targetDate.getTime() + MANILA_OFFSET_MS);
  const manilaMidnightUtcMs =
    Date.UTC(manilaWallClock.getUTCFullYear(), manilaWallClock.getUTCMonth(), manilaWallClock.getUTCDate(), 0, 0, 0) - MANILA_OFFSET_MS;
  return { start: new Date(manilaMidnightUtcMs), end: new Date(manilaMidnightUtcMs + 24 * 60 * 60 * 1000) };
}

/** The Asia/Manila calendar-day start for `targetDate` - what gets stored in `triggerDate` (one row per calendar day, never per exact timestamp). */
function manilaCalendarDay(targetDate: Date): Date {
  return manilaDayRange(targetDate).start;
}

/**
 * Mirrors PrismaPaymentReminderRepository's "next not-fully-paid installment per loan" live
 * computation (same reasoning: `RepaymentSchedule.status` never auto-flips PENDING->LATE, so
 * `status != 'PAID'` + application-side ordering is the reliable way to find it) - filtered here
 * to installments whose dueDate falls exactly on the target Manila calendar day, instead of "any
 * upcoming/overdue".
 */
export class PrismaSmsReminderRepository implements ISmsReminderRepository {
  async findCandidatesDueOn(targetDate: Date, branchId: string | undefined): Promise<SmsReminderCandidate[]> {
    const { start, end } = manilaDayRange(targetDate);
    const loanAccountFilter = {
      status: { in: [...ACTIVE_LOAN_STATUSES] },
      ...(branchId ? { branchId } : {}),
    };

    const candidateRows = await prisma.repaymentSchedule.findMany({
      where: { status: { not: 'PAID' }, loanAccount: loanAccountFilter },
      orderBy: [{ loanAccountId: 'asc' }, { installmentNumber: 'asc' }],
      include: {
        loanAccount: {
          select: {
            loanCode: true,
            branchId: true,
            borrower: { select: { firstName: true, lastName: true, mobilePhone1: true, smsRemindersEnabled: true } },
          },
        },
      },
    });

    const seenLoanIds = new Set<string>();
    const candidates: SmsReminderCandidate[] = [];
    for (const row of candidateRows) {
      if (seenLoanIds.has(row.loanAccountId)) continue; // rows ordered by installmentNumber asc - first hit per loan is the next-due one.
      seenLoanIds.add(row.loanAccountId);

      if (row.dueDate.getTime() < start.getTime() || row.dueDate.getTime() >= end.getTime()) continue; // next-due isn't due on targetDate
      if (!row.loanAccount.borrower.smsRemindersEnabled) continue;
      const phoneNumber = row.loanAccount.borrower.mobilePhone1;
      if (!phoneNumber) continue;

      const amountDueTotal =
        Number(row.principalDue) + Number(row.interestDue) + Number(row.feesDue) + Number(row.penaltyDue);

      candidates.push({
        installmentId: row.id,
        loanAccountId: row.loanAccountId,
        loanCode: row.loanAccount.loanCode,
        branchId: row.loanAccount.branchId,
        borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
        phoneNumber,
        dueDate: row.dueDate,
        amountDueTotal: amountDueTotal.toString(),
        daysLate: null,
        totalAmountDue: null,
      });
    }

    return candidates;
  }

  async findPastDueCandidates(branchId: string | undefined): Promise<SmsReminderCandidate[]> {
    const now = new Date();
    const loanAccountFilter = {
      status: { in: [...ACTIVE_LOAN_STATUSES] },
      ...(branchId ? { branchId } : {}),
    };

    const overdueRows = await prisma.repaymentSchedule.findMany({
      where: { status: { not: 'PAID' }, dueDate: { lt: now }, loanAccount: loanAccountFilter },
      orderBy: [{ loanAccountId: 'asc' }, { dueDate: 'asc' }],
      include: {
        loanAccount: {
          select: {
            loanCode: true,
            branchId: true,
            borrower: { select: { firstName: true, lastName: true, mobilePhone1: true, smsRemindersEnabled: true } },
          },
        },
      },
    });

    const byLoan = new Map<
      string,
      { rows: typeof overdueRows; oldestDueDate: Date }
    >();
    for (const row of overdueRows) {
      const existing = byLoan.get(row.loanAccountId);
      if (existing) {
        existing.rows.push(row);
      } else {
        byLoan.set(row.loanAccountId, { rows: [row], oldestDueDate: row.dueDate }); // rows ordered by dueDate asc - first hit per loan is the oldest overdue installment.
      }
    }

    const candidates: SmsReminderCandidate[] = [];
    for (const [loanAccountId, { rows, oldestDueDate }] of byLoan) {
      const first = rows[0]!;
      if (!first.loanAccount.borrower.smsRemindersEnabled) continue;
      const phoneNumber = first.loanAccount.borrower.mobilePhone1;
      if (!phoneNumber) continue;

      const totalAmountDue = rows.reduce((sum, r) => {
        const due = Number(r.principalDue) + Number(r.interestDue) + Number(r.feesDue) + Number(r.penaltyDue);
        const paid = Number(r.principalPaid) + Number(r.interestPaid) + Number(r.feesPaid) + Number(r.penaltyPaid);
        return sum + Math.max(0, due - paid);
      }, 0);
      const daysLate = Math.floor((now.getTime() - oldestDueDate.getTime()) / (24 * 60 * 60 * 1000));

      candidates.push({
        installmentId: null, // PAST_DUE_WEEKLY sums across every overdue installment, not one
        loanAccountId,
        loanCode: first.loanAccount.loanCode,
        branchId: first.loanAccount.branchId,
        borrowerName: `${first.loanAccount.borrower.firstName} ${first.loanAccount.borrower.lastName}`,
        phoneNumber,
        dueDate: null,
        amountDueTotal: '0',
        daysLate,
        totalAmountDue: totalAmountDue.toString(),
      });
    }

    return candidates;
  }

  async existsForTrigger(loanAccountId: string, triggerType: ReminderTriggerType, triggerDate: Date): Promise<boolean> {
    const existing = await prisma.smsReminderLog.findUnique({
      where: { loanAccountId_triggerType_triggerDate: { loanAccountId, triggerType, triggerDate: manilaCalendarDay(triggerDate) } },
    });
    return existing !== null;
  }

  async logSent(input: LogReminderSentInput): Promise<void> {
    await prisma.smsReminderLog.create({
      data: {
        loanAccountId: input.loanAccountId,
        installmentId: input.installmentId,
        triggerType: input.triggerType,
        triggerDate: manilaCalendarDay(input.triggerDate),
        phoneNumber: input.phoneNumber,
        message: input.message,
        status: 'SENT',
        providerTransId: input.providerTransId,
      },
    });
  }

  async logFailed(input: LogReminderFailedInput): Promise<void> {
    await prisma.smsReminderLog.create({
      data: {
        loanAccountId: input.loanAccountId,
        installmentId: input.installmentId,
        triggerType: input.triggerType,
        triggerDate: manilaCalendarDay(input.triggerDate),
        phoneNumber: input.phoneNumber,
        message: input.message,
        status: 'FAILED',
        errorMessage: input.errorMessage,
      },
    });
  }

  async updateDeliveryStatus(providerTransId: string, status: 'DELIVERED' | 'UNDELIVERED' | 'REJECTED', deliveredAt: Date): Promise<void> {
    await prisma.smsReminderLog.updateMany({
      where: { providerTransId },
      data: { status, deliveredAt },
    });
  }

  async listLogs(branchId: string | undefined, loanAccountId?: string): Promise<SmsReminderLogRow[]> {
    const rows = await prisma.smsReminderLog.findMany({
      where: {
        ...(branchId ? { loanAccount: { branchId } } : {}),
        ...(loanAccountId ? { loanAccountId } : {}),
      },
      orderBy: { sentAt: 'desc' },
      include: {
        loanAccount: { select: { loanCode: true, branchId: true, borrower: { select: { firstName: true, lastName: true } } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      loanCode: row.loanAccount.loanCode,
      branchId: row.loanAccount.branchId,
      borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
      phoneNumber: row.phoneNumber,
      message: row.message,
      triggerType: row.triggerType,
      triggerDate: row.triggerDate,
      status: row.status,
      providerTransId: row.providerTransId,
      errorMessage: row.errorMessage,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
    }));
  }
}
