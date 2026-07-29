import { prisma } from '@shared/database/prismaClient';
import type { IPaymentReminderRepository, PaymentReminderCandidate } from '../application/ports/IPaymentReminderRepository';

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;

function toAmountsDto(row: {
  principalDue: unknown;
  interestDue: unknown;
  feesDue: unknown;
  penaltyDue: unknown;
}): { principal: string; interest: string; fees: string; penalty: string; total: string } {
  const principal = Number(row.principalDue);
  const interest = Number(row.interestDue);
  const fees = Number(row.feesDue);
  const penalty = Number(row.penaltyDue);
  return {
    principal: principal.toString(),
    interest: interest.toString(),
    fees: fees.toString(),
    penalty: penalty.toString(),
    total: (principal + interest + fees + penalty).toString(),
  };
}

function toPaidAmountsDto(row: {
  principalPaid: unknown;
  interestPaid: unknown;
  feesPaid: unknown;
  penaltyPaid: unknown;
}): { principal: string; interest: string; fees: string; penalty: string; total: string } {
  const principal = Number(row.principalPaid);
  const interest = Number(row.interestPaid);
  const fees = Number(row.feesPaid);
  const penalty = Number(row.penaltyPaid);
  return {
    principal: principal.toString(),
    interest: interest.toString(),
    fees: fees.toString(),
    penalty: penalty.toString(),
    total: (principal + interest + fees + penalty).toString(),
  };
}

/**
 * Mirrors PrismaDashboardRepository: computed on demand, no summary table, no caching —
 * acceptable at today's volume (see that file's doc comment for the same tradeoff).
 *
 * The stored `RepaymentSchedule.status` column only ever reliably means "PAID" or not — it never
 * auto-flips PENDING→LATE just because time passed without a write (see
 * PrismaRepaymentInstallmentRepository's doc comment). So this repository uses `status != 'PAID'`
 * (reliable) to find each loan's next unpaid installment, then derives LATE/PARTIALLY_PAID/PENDING
 * itself from `dueDate` vs now and the paid amounts — never trusting a stale stored LATE/PENDING
 * value.
 */
export class PrismaPaymentReminderRepository implements IPaymentReminderRepository {
  async findNextDueInstallments(branchId: string | undefined): Promise<PaymentReminderCandidate[]> {
    const loanAccountFilter = {
      status: { in: [...ACTIVE_LOAN_STATUSES] },
      ...(branchId ? { branchId } : {}),
    };

    const [paidCounts, totalCounts, candidateRows] = await Promise.all([
      prisma.repaymentSchedule.groupBy({
        by: ['loanAccountId'],
        where: { status: 'PAID', loanAccount: loanAccountFilter },
        _count: true,
      }),
      prisma.repaymentSchedule.groupBy({
        by: ['loanAccountId'],
        where: { loanAccount: loanAccountFilter },
        _count: true,
      }),
      prisma.repaymentSchedule.findMany({
        where: { status: { not: 'PAID' }, loanAccount: loanAccountFilter },
        orderBy: [{ loanAccountId: 'asc' }, { installmentNumber: 'asc' }],
        include: {
          loanAccount: {
            select: { loanCode: true, branchId: true, borrower: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
    ]);

    const paidCountByLoan = new Map(paidCounts.map((g) => [g.loanAccountId, g._count]));
    const totalCountByLoan = new Map(totalCounts.map((g) => [g.loanAccountId, g._count]));

    const now = Date.now();
    const nextDueByLoan = new Map<string, PaymentReminderCandidate>();
    for (const row of candidateRows) {
      if (nextDueByLoan.has(row.loanAccountId)) continue; // rows are ordered by installmentNumber asc — first hit per loan is the next-due one.

      const paidTotal = Number(row.principalPaid) + Number(row.interestPaid) + Number(row.feesPaid) + Number(row.penaltyPaid);
      const status = row.dueDate.getTime() < now ? 'LATE' : paidTotal > 0 ? 'PARTIALLY_PAID' : 'PENDING';

      nextDueByLoan.set(row.loanAccountId, {
        installmentId: row.id,
        loanAccountId: row.loanAccountId,
        loanCode: row.loanAccount.loanCode,
        branchId: row.loanAccount.branchId,
        borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        due: toAmountsDto(row),
        paid: toPaidAmountsDto(row),
        status,
        installmentsPaidCount: paidCountByLoan.get(row.loanAccountId) ?? 0,
        installmentsTotalCount: totalCountByLoan.get(row.loanAccountId) ?? 0,
      });
    }

    return [...nextDueByLoan.values()].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
}
