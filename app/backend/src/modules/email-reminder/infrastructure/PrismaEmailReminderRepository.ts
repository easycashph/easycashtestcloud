import { prisma } from '@shared/database/prismaClient';
import type {
  EmailReminderCandidate,
  EmailReminderLogRow,
  IEmailReminderRepository,
  LogEmailReminderFailedInput,
  LogEmailReminderSentInput,
  ReminderTriggerType,
} from '../application/ports/IEmailReminderRepository';

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** See PrismaSmsReminderRepository's identical helper for the full reasoning (Manila is fixed UTC+8, no DST). */
function manilaDayRange(targetDate: Date): { start: Date; end: Date } {
  const manilaWallClock = new Date(targetDate.getTime() + MANILA_OFFSET_MS);
  const manilaMidnightUtcMs =
    Date.UTC(manilaWallClock.getUTCFullYear(), manilaWallClock.getUTCMonth(), manilaWallClock.getUTCDate(), 0, 0, 0) - MANILA_OFFSET_MS;
  return { start: new Date(manilaMidnightUtcMs), end: new Date(manilaMidnightUtcMs + 24 * 60 * 60 * 1000) };
}

function manilaCalendarDay(targetDate: Date): Date {
  return manilaDayRange(targetDate).start;
}

/** Mirrors PrismaSmsReminderRepository exactly - same live "next-due installment"/"overdue sum"
 * queries, keyed on `borrower.email` instead of `mobilePhone1`; skips a candidate with no email on file. */
export class PrismaEmailReminderRepository implements IEmailReminderRepository {
  async findCandidatesDueOn(targetDate: Date, branchId: string | undefined): Promise<EmailReminderCandidate[]> {
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
            borrower: { select: { firstName: true, lastName: true, email: true, smsRemindersEnabled: true } },
          },
        },
      },
    });

    const seenLoanIds = new Set<string>();
    const candidates: EmailReminderCandidate[] = [];
    for (const row of candidateRows) {
      if (seenLoanIds.has(row.loanAccountId)) continue;
      seenLoanIds.add(row.loanAccountId);

      if (row.dueDate.getTime() < start.getTime() || row.dueDate.getTime() >= end.getTime()) continue;
      if (!row.loanAccount.borrower.smsRemindersEnabled) continue;
      const email = row.loanAccount.borrower.email;
      if (!email) continue;

      const amountDueTotal =
        Number(row.principalDue) + Number(row.interestDue) + Number(row.feesDue) + Number(row.penaltyDue);

      candidates.push({
        installmentId: row.id,
        loanAccountId: row.loanAccountId,
        loanCode: row.loanAccount.loanCode,
        branchId: row.loanAccount.branchId,
        borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
        email,
        dueDate: row.dueDate,
        amountDueTotal: amountDueTotal.toString(),
        daysLate: null,
        totalAmountDue: null,
      });
    }

    return candidates;
  }

  async findPastDueCandidates(branchId: string | undefined): Promise<EmailReminderCandidate[]> {
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
            borrower: { select: { firstName: true, lastName: true, email: true, smsRemindersEnabled: true } },
          },
        },
      },
    });

    const byLoan = new Map<string, { rows: typeof overdueRows; oldestDueDate: Date }>();
    for (const row of overdueRows) {
      const existing = byLoan.get(row.loanAccountId);
      if (existing) {
        existing.rows.push(row);
      } else {
        byLoan.set(row.loanAccountId, { rows: [row], oldestDueDate: row.dueDate });
      }
    }

    const candidates: EmailReminderCandidate[] = [];
    for (const [loanAccountId, { rows, oldestDueDate }] of byLoan) {
      const first = rows[0]!;
      if (!first.loanAccount.borrower.smsRemindersEnabled) continue;
      const email = first.loanAccount.borrower.email;
      if (!email) continue;

      const totalAmountDue = rows.reduce((sum, r) => {
        const due = Number(r.principalDue) + Number(r.interestDue) + Number(r.feesDue) + Number(r.penaltyDue);
        const paid = Number(r.principalPaid) + Number(r.interestPaid) + Number(r.feesPaid) + Number(r.penaltyPaid);
        return sum + Math.max(0, due - paid);
      }, 0);
      const daysLate = Math.floor((now.getTime() - oldestDueDate.getTime()) / (24 * 60 * 60 * 1000));

      candidates.push({
        installmentId: null,
        loanAccountId,
        loanCode: first.loanAccount.loanCode,
        branchId: first.loanAccount.branchId,
        borrowerName: `${first.loanAccount.borrower.firstName} ${first.loanAccount.borrower.lastName}`,
        email,
        dueDate: null,
        amountDueTotal: '0',
        daysLate,
        totalAmountDue: totalAmountDue.toString(),
      });
    }

    return candidates;
  }

  async existsForTrigger(loanAccountId: string, triggerType: ReminderTriggerType, triggerDate: Date): Promise<boolean> {
    const existing = await prisma.emailReminderLog.findUnique({
      where: { loanAccountId_triggerType_triggerDate: { loanAccountId, triggerType, triggerDate: manilaCalendarDay(triggerDate) } },
    });
    return existing !== null;
  }

  async logSent(input: LogEmailReminderSentInput): Promise<void> {
    await prisma.emailReminderLog.create({
      data: {
        loanAccountId: input.loanAccountId,
        installmentId: input.installmentId,
        triggerType: input.triggerType,
        triggerDate: manilaCalendarDay(input.triggerDate),
        recipientEmail: input.recipientEmail,
        message: input.message,
        status: 'SENT',
      },
    });
  }

  async logFailed(input: LogEmailReminderFailedInput): Promise<void> {
    await prisma.emailReminderLog.create({
      data: {
        loanAccountId: input.loanAccountId,
        installmentId: input.installmentId,
        triggerType: input.triggerType,
        triggerDate: manilaCalendarDay(input.triggerDate),
        recipientEmail: input.recipientEmail,
        message: input.message,
        status: 'FAILED',
        errorMessage: input.errorMessage,
      },
    });
  }

  async listLogs(branchId: string | undefined, loanAccountId?: string): Promise<EmailReminderLogRow[]> {
    const rows = await prisma.emailReminderLog.findMany({
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
      recipientEmail: row.recipientEmail,
      message: row.message,
      triggerType: row.triggerType,
      triggerDate: row.triggerDate,
      status: row.status,
      errorMessage: row.errorMessage,
      sentAt: row.sentAt,
    }));
  }
}
