import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type {
  AccountsWithPastDueReportRow,
  AgingReportRow,
  CollectionHistoryReportRow,
  CollectionReportRow,
  DailyCollectionReportRow,
  DateRangeFilter,
  EndingBalanceReportRow,
  ExpectedCollectionReportRow,
  FirstAmortizationReportRow,
  FullyPaidAccountsReportRow,
  IReportingRepository,
  ListReportTransactionsOptions,
  LoanReleaseReportRow,
  OriginationReportRow,
  ReportGranularity,
  TransactionReportRow,
} from '../application/ports/IReportingRepository';

/** Frozen-if-overridden penalty, matching the ADR-050 "effective chargeable amount" convention
 * used throughout the loan-account/repayment modules (never the live daily-accrual formula in a
 * reporting context - reports read stored figures, same simplification `LoanAccount.balances`
 * already accepts). */
function effectivePenalty(installment: { penaltyDue: Prisma.Decimal; penaltyOverrideAmount: Prisma.Decimal | null }): number {
  return installment.penaltyOverrideAmount !== null ? Number(installment.penaltyOverrideAmount) : Number(installment.penaltyDue);
}

function effectiveFees(installment: { feesDue: Prisma.Decimal; feesOverrideAmount: Prisma.Decimal | null }): number {
  return installment.feesOverrideAmount !== null ? Number(installment.feesOverrideAmount) : Number(installment.feesDue);
}

function daysLateOf(dueDate: Date, today: Date): number {
  const late = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
  return late > 0 ? late : 0;
}

/** Matches `RepaymentInstallmentStatus` exactly to the legacy reports' own "REPAYMENT STATE"/"STATE" text. */
const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  LATE: 'Late',
};

/** Mirrors frontend `staticConfig.ts`'s `ACTIVE_PAYMENT_METHODS` labels - small intentional
 * duplication (display-label mapping only) rather than a cross-package import. */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  GCASH: 'GCash',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  PDC: 'Post-Dated Check (PDC)',
  AUTO_DEBIT: 'Auto Debit',
};

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  DISBURSEMENT: 'Disbursement',
  REPAYMENT: 'Repayment',
  FEE_CHARGED: 'Fee Charged',
  PENALTY_APPLIED: 'Penalty Applied',
  INTEREST_APPLIED: 'Interest Applied',
  DEFERRED_INTEREST_APPLIED: 'Deferred Interest Applied',
  DEFERRED_INTEREST_PAID: 'Deferred Interest Paid',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  REVERSAL: 'Reversal',
};

function groupByLoanId<T extends { loanAccountId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.loanAccountId) ?? [];
    list.push(row);
    map.set(row.loanAccountId, list);
  }
  return map;
}

/** UTC bucket key per granularity — 'YYYY-MM-DD' / 'YYYY-MM' / 'YYYY'. Grouping happens in JS, not SQL, mirroring PrismaDashboardRepository's "computed on demand, no summary table" posture at today's volume. */
function bucketKey(date: Date, granularity: ReportGranularity): string {
  const iso = date.toISOString();
  if (granularity === 'DAILY') return iso.slice(0, 10);
  if (granularity === 'MONTHLY') return iso.slice(0, 7);
  return iso.slice(0, 4);
}

function entryDateFilter(filter: DateRangeFilter): { gte?: Date; lte?: Date } | undefined {
  if (!filter.from && !filter.to) return undefined;
  return { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
}

/**
 * Milestone 9.2 / Reports: same posture as PrismaDashboardRepository — every row below is
 * computed on demand from `loan_accounts`/`loan_transactions`, no summary table, no caching.
 * Acceptable at today's volume (thousands of loans); revisit with a materialized rollup if a wide
 * daily-granularity date range becomes a real cost at 100,000+ scale.
 */
export class PrismaReportingRepository implements IReportingRepository {
  async getLoanOriginationReport(
    granularity: ReportGranularity,
    filter: DateRangeFilter & { branchId?: string },
  ): Promise<OriginationReportRow[]> {
    const activatedAtFilter = entryDateFilter(filter);
    const rows = await prisma.loanAccount.findMany({
      where: {
        activatedAt: { not: null, ...activatedAtFilter },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      select: { activatedAt: true, principalAmount: true },
    });

    const byBucket = new Map<string, { loansOriginated: number; amountOriginated: number }>();
    for (const row of rows) {
      // row.activatedAt is guaranteed non-null by the `not: null` filter above.
      const key = bucketKey(row.activatedAt as Date, granularity);
      const existing = byBucket.get(key) ?? { loansOriginated: 0, amountOriginated: 0 };
      existing.loansOriginated += 1;
      existing.amountOriginated += Number(row.principalAmount);
      byBucket.set(key, existing);
    }

    return [...byBucket.entries()]
      .map(([period, v]) => ({ period, loansOriginated: v.loansOriginated, amountOriginated: v.amountOriginated.toString() }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getCollectionReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]> {
    const rows = await prisma.loanTransaction.findMany({
      where: {
        type: 'REPAYMENT',
        entryDate: entryDateFilter(filter),
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      select: { entryDate: true, amount: true },
    });

    const byBucket = new Map<string, number>();
    for (const row of rows) {
      const key = bucketKey(row.entryDate, granularity);
      byBucket.set(key, (byBucket.get(key) ?? 0) + Number(row.amount));
    }

    return [...byBucket.entries()]
      .map(([period, amountCollected]) => ({ period, amountCollected: amountCollected.toString() }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async listTransactions(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]> {
    // Same same-day ordering fix as PrismaLoanTransactionRepository.findByLoanAccountId (see that
    // method's own doc comment) — REVERSAL/DISBURSEMENT's real time-of-day entryDate otherwise
    // always outranks a same-day REPAYMENT's date-only (midnight) entryDate.
    const range = entryDateFilter(options);
    const typeClause = options.type ? Prisma.sql`AND lt."type" = ${options.type}::"LoanTransactionType"` : Prisma.empty;
    const branchClause = options.branchId ? Prisma.sql`AND lt."branchId" = ${options.branchId}` : Prisma.empty;
    const fromClause = range?.gte ? Prisma.sql`AND lt."entryDate" >= ${range.gte}` : Prisma.empty;
    const toClause = range?.lte ? Prisma.sql`AND lt."entryDate" <= ${range.lte}` : Prisma.empty;
    const cursorClause = options.cursor
      ? Prisma.sql`AND (DATE(lt."entryDate"), lt."createdAt", lt.id) < (
          SELECT DATE(c."entryDate"), c."createdAt", c.id FROM loan_transactions c WHERE c.id = ${options.cursor}
        )`
      : Prisma.empty;

    const orderedIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT lt.id
      FROM loan_transactions lt
      WHERE 1=1
      ${typeClause}
      ${branchClause}
      ${fromClause}
      ${toClause}
      ${cursorClause}
      ORDER BY DATE(lt."entryDate") DESC, lt."createdAt" DESC, lt.id DESC
      LIMIT ${options.limit}
    `);

    if (orderedIds.length === 0) return [];

    const found = await prisma.loanTransaction.findMany({
      where: { id: { in: orderedIds.map((r) => r.id) } },
      include: {
        loanAccount: { select: { loanCode: true, borrower: { select: { firstName: true, lastName: true } } } },
        branch: { select: { name: true } },
      },
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    const rows = orderedIds.map((r) => byId.get(r.id)!);

    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      loanCode: row.loanAccount.loanCode,
      borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
      branchId: row.branchId,
      branchName: row.branch.name,
      type: row.type,
      amount: row.amount.toString(),
      components: {
        principal: row.principalComponent.toString(),
        interest: row.interestComponent.toString(),
        fees: row.feesComponent.toString(),
        penalty: row.penaltyComponent.toString(),
      },
      entryDate: row.entryDate,
      comment: row.comment ?? null,
    }));
  }

  async getLoanReleasesReport(filter: DateRangeFilter & { branchId?: string }): Promise<LoanReleaseReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        activatedAt: { not: null, ...entryDateFilter(filter) },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: {
        borrower: { include: { incomeDetail: true } },
        loanProductVersion: { include: { loanProduct: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });
    if (loans.length === 0) return [];

    // Address has no Prisma relation to Borrower (polymorphic ownerType/ownerId) — same bulk-fetch-
    // then-group pattern as PrismaBorrowerRepository, not a per-loan query.
    const borrowerIds = [...new Set(loans.map((loan) => loan.borrowerId))];
    const addressRows = await prisma.address.findMany({ where: { ownerType: 'BORROWER', ownerId: { in: borrowerIds } } });
    const addressByBorrowerId = new Map<string, (typeof addressRows)[number][]>();
    for (const address of addressRows) {
      const list = addressByBorrowerId.get(address.ownerId) ?? [];
      list.push(address);
      addressByBorrowerId.set(address.ownerId, list);
    }

    const loanIds = loans.map((loan) => loan.id);
    const scheduleRows = await prisma.repaymentSchedule.findMany({
      where: { loanAccountId: { in: loanIds } },
      orderBy: { installmentNumber: 'asc' },
    });
    const scheduleByLoanId = new Map<string, (typeof scheduleRows)[number][]>();
    for (const installment of scheduleRows) {
      const list = scheduleByLoanId.get(installment.loanAccountId) ?? [];
      list.push(installment);
      scheduleByLoanId.set(installment.loanAccountId, list);
    }

    return loans.map((loan) => {
      const schedule = scheduleByLoanId.get(loan.id) ?? [];
      const totalInterest = schedule.reduce((sum, installment) => sum + Number(installment.interestDue), 0);
      const maturityDate = schedule.length > 0 ? schedule[schedule.length - 1]!.dueDate : null;
      const firstInstallment = schedule[0];
      const amortization = firstInstallment ? Number(firstInstallment.principalDue) + Number(firstInstallment.interestDue) : 0;
      const address = addressByBorrowerId.get(loan.borrowerId)?.[0];

      return {
        clientId: loan.borrowerId,
        clientName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
        address: formatAddress(address),
        product: loan.loanProductVersion.loanProduct.name,
        accountId: loan.loanCode,
        agencyCompany: loan.borrower.incomeDetail?.employerName ?? '',
        disbursementDate: loan.activatedAt!,
        loanCreated: loan.createdAt,
        maturityDate,
        term: loan.installmentCount,
        nthLoan: loan.borrower.loanCycle,
        newOrRenew: loan.borrower.loanCycle > 1 ? 'Renew' : 'New',
        firstRepaymentDate: loan.firstRepaymentDate,
        amortization: amortization.toFixed(2),
        loanAmount: loan.principalAmount.toString(),
        totalInterest: totalInterest.toFixed(2),
        totalOB: (Number(loan.principalAmount) + totalInterest).toFixed(2),
        addOnInterestRate: loan.addOnInterestRate?.toString() ?? null,
        contractualInterestRate: loan.contractualInterestRate?.toString() ?? null,
        advanceInterestFee: loan.advanceInterestFee.toString(),
        processingFee: loan.processingFee.toString(),
        documentationFee: loan.docStampFee.toString(),
        outstandingLoanBalance: loan.outstandingBalancePayoff.toString(),
        accountManagementFee: loan.accountManagementFee.toString(),
        insurance: loan.insuranceFee.toString(),
        notarial: loan.notarialFee.toString(),
        webFee: loan.webFee.toString(),
        totalNetAmount: loan.netProceeds.toString(),
      };
    });
  }

  /** As-of-today snapshot, no date filter (confirmed with the user - the legacy Aging Report sample
   * has no date-range column). Each unpaid installment's own remaining due buckets by ITS OWN days
   * late (not the loan's oldest-unpaid days late) - matches the legacy sample's per-account TOTAL
   * being the sum of every bucket, not a single bucket's value. */
  async getAgingReport(filter: { branchId?: string }): Promise<AgingReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } },
    });
    if (loans.length === 0) return [];

    const loanIds = loans.map((loan) => loan.id);
    const schedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'asc' } });
    const scheduleByLoanId = groupByLoanId(schedule);
    const today = new Date();

    return loans.map((loan) => {
      const installments = scheduleByLoanId.get(loan.id) ?? [];
      const maturityDate = installments.length > 0 ? installments[installments.length - 1]!.dueDate : null;

      const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91to120: 0, days121to150: 0, days150Plus: 0 };
      for (const installment of installments) {
        if (installment.status === 'PAID') continue;
        const remaining =
          Number(installment.principalDue) - Number(installment.principalPaid) +
          (Number(installment.interestDue) - Number(installment.interestPaid)) +
          (effectiveFees(installment) - Number(installment.feesPaid)) +
          (effectivePenalty(installment) - Number(installment.penaltyPaid));
        if (remaining <= 0) continue;
        const late = daysLateOf(installment.dueDate, today);
        if (late === 0) buckets.current += remaining;
        else if (late <= 30) buckets.days1to30 += remaining;
        else if (late <= 60) buckets.days31to60 += remaining;
        else if (late <= 90) buckets.days61to90 += remaining;
        else if (late <= 120) buckets.days91to120 += remaining;
        else if (late <= 150) buckets.days121to150 += remaining;
        else buckets.days150Plus += remaining;
      }
      const total = Object.values(buckets).reduce((sum, v) => sum + v, 0);

      return {
        clientName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
        product: loan.loanProductVersion.loanProduct.name,
        accountId: loan.loanCode,
        state: loan.status,
        maturityDate,
        current: buckets.current.toFixed(2),
        days1to30: buckets.days1to30.toFixed(2),
        days31to60: buckets.days31to60.toFixed(2),
        days61to90: buckets.days61to90.toFixed(2),
        days91to120: buckets.days91to120.toFixed(2),
        days121to150: buckets.days121to150.toFixed(2),
        days150Plus: buckets.days150Plus.toFixed(2),
        total: total.toFixed(2),
      };
    });
  }

  /** As-of-today snapshot. TOTAL OBLIGATION = principal + interest + fees balance only, matching
   * the legacy sample's column set (no penalty column on this report). */
  async getEndingBalanceReport(filter: { branchId?: string }): Promise<EndingBalanceReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS', 'CLOSED', 'CLOSED_WRITTEN_OFF', 'CLOSED_RESTRUCTURED'] },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } },
    });
    if (loans.length === 0) return [];

    const loanIds = loans.map((loan) => loan.id);
    const schedule = await prisma.repaymentSchedule.findMany({
      where: { loanAccountId: { in: loanIds } },
      orderBy: { installmentNumber: 'desc' },
    });
    const maturityByLoanId = new Map<string, Date>();
    for (const installment of schedule) {
      if (!maturityByLoanId.has(installment.loanAccountId)) maturityByLoanId.set(installment.loanAccountId, installment.dueDate);
    }

    return loans.map((loan) => ({
      clientName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      product: loan.loanProductVersion.loanProduct.name,
      loanAccountId: loan.loanCode,
      loanAmount: loan.principalAmount.toString(),
      principalBalance: loan.principalBalance.toString(),
      interestBalance: loan.interestBalance.toString(),
      feesBalance: loan.feesBalance.toString(),
      totalObligation: (Number(loan.principalBalance) + Number(loan.interestBalance) + Number(loan.feesBalance)).toFixed(2),
      maturityDate: maturityByLoanId.get(loan.id) ?? null,
      termRate: `${loan.installmentCount} Month/s`,
      interestRate: loan.interestRate.toString(),
      accountState: loan.status,
    }));
  }

  /** As-of-today snapshot: only loans with the oldest unpaid installment currently overdue.
   * AMOUNT DUE / REPAYMENT / LACK-EXCESS are that one installment's total due, total paid, and
   * their difference - matches the legacy sample's exact arithmetic. */
  async getAccountsWithPastDueReport(filter: { branchId?: string }): Promise<AccountsWithPastDueReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } },
    });
    if (loans.length === 0) return [];

    const loanIds = loans.map((loan) => loan.id);
    const schedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'asc' } });
    const scheduleByLoanId = groupByLoanId(schedule);
    const today = new Date();

    const rows: AccountsWithPastDueReportRow[] = [];
    for (const loan of loans) {
      const installments = scheduleByLoanId.get(loan.id) ?? [];
      const maturityDate = installments.length > 0 ? installments[installments.length - 1]!.dueDate : null;
      const unpaid = installments.filter((i) => i.status !== 'PAID');
      const oldestUnpaid = unpaid[0];
      if (!oldestUnpaid) continue;
      const daysLate = daysLateOf(oldestUnpaid.dueDate, today);
      if (daysLate === 0) continue;

      const amountDue =
        Number(oldestUnpaid.principalDue) + Number(oldestUnpaid.interestDue) + effectiveFees(oldestUnpaid) + effectivePenalty(oldestUnpaid);
      const repayment =
        Number(oldestUnpaid.principalPaid) + Number(oldestUnpaid.interestPaid) + Number(oldestUnpaid.feesPaid) + Number(oldestUnpaid.penaltyPaid);
      const lastPaid = [...installments].filter((i) => i.lastPaidAt).sort((a, b) => b.lastPaidAt!.getTime() - a.lastPaidAt!.getTime())[0];

      rows.push({
        clientName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
        product: loan.loanProductVersion.loanProduct.name,
        accountId: loan.loanCode,
        accountState: loan.status,
        dueDate: oldestUnpaid.dueDate,
        maturityDate,
        lastPaidDate: lastPaid?.lastPaidAt ?? null,
        currentAmountDue: amountDue.toFixed(2),
        pastAmountDue: amountDue.toFixed(2),
        daysLate,
        repayment: repayment.toFixed(2),
        lackOrExcess: (amountDue - repayment).toFixed(2),
        repaymentState: INSTALLMENT_STATUS_LABEL[oldestUnpaid.status] ?? oldestUnpaid.status,
        countOfPaidDue: installments.filter((i) => i.status === 'PAID').length,
      });
    }
    return rows;
  }

  /** One row PER INSTALLMENT (not per loan) with payment history - matches the legacy "Collection"
   * report's structure (a paid-installment ledger, not an account summary). */
  async getCollectionHistoryReport(filter: DateRangeFilter & { branchId?: string }): Promise<CollectionHistoryReportRow[]> {
    const installments = await prisma.repaymentSchedule.findMany({
      where: {
        status: { in: ['PAID', 'PARTIALLY_PAID', 'LATE'] },
        dueDate: entryDateFilter(filter),
        loanAccount: filter.branchId ? { branchId: filter.branchId } : undefined,
      },
      include: { loanAccount: { include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } } } },
      orderBy: { dueDate: 'desc' },
    });
    if (installments.length === 0) return [];

    const loanIds = [...new Set(installments.map((i) => i.loanAccountId))];
    const fullSchedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'asc' } });
    const scheduleByLoanId = groupByLoanId(fullSchedule);

    return installments.map((installment) => {
      const loanSchedule = scheduleByLoanId.get(installment.loanAccountId) ?? [];
      const maturityDate = loanSchedule.length > 0 ? loanSchedule[loanSchedule.length - 1]!.dueDate : null;
      const amountDue = Number(installment.principalDue) + Number(installment.interestDue) + effectiveFees(installment) + effectivePenalty(installment);
      const repayment =
        Number(installment.principalPaid) + Number(installment.interestPaid) + Number(installment.feesPaid) + Number(installment.penaltyPaid);

      return {
        clientName: `${installment.loanAccount.borrower.firstName} ${installment.loanAccount.borrower.lastName}`,
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        dueDate: installment.dueDate,
        maturityDate,
        lastPaidDate: installment.lastPaidAt,
        amountDue: amountDue.toFixed(2),
        repayment: repayment.toFixed(2),
        lackOrExcess: (amountDue - repayment).toFixed(2),
        repaymentState: INSTALLMENT_STATUS_LABEL[installment.status] ?? installment.status,
        repaymentCount: loanSchedule.filter((i) => i.lastPaidAt !== null).length,
        installmentNumber: installment.installmentNumber,
      };
    });
  }

  /**
   * "What should come in and when" - one row per (loan, installment) whose `dueDate` falls in the
   * selected range (defaults to the current month), regardless of paid status - re-derived from the
   * two real legacy samples (`Collection-Expected Collection.xlsx` and its "(1)" duplicate, which
   * differ only in which month's installments they cover). PAST DUE AMOUNT is the total remaining
   * unpaid on any of the loan's OTHER installments due before the range start - separate backlog
   * from the "this period" installment shown in the other columns.
   */
  async getExpectedCollectionReport(filter: DateRangeFilter & { branchId?: string }): Promise<ExpectedCollectionReportRow[]> {
    const range = entryDateFilter(filter);
    const installments = await prisma.repaymentSchedule.findMany({
      where: {
        dueDate: range,
        loanAccount: {
          status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
          ...(filter.branchId ? { branchId: filter.branchId } : {}),
        },
      },
      include: { loanAccount: { include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } } } },
      orderBy: { dueDate: 'asc' },
    });
    if (installments.length === 0) return [];

    const loanIds = [...new Set(installments.map((i) => i.loanAccountId))];
    const fullSchedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'asc' } });
    const scheduleByLoanId = groupByLoanId(fullSchedule);
    const today = new Date();

    return installments.map((installment) => {
      const loanSchedule = scheduleByLoanId.get(installment.loanAccountId) ?? [];
      const maturityDate = loanSchedule.length > 0 ? loanSchedule[loanSchedule.length - 1]!.dueDate : null;
      const pastDueAmount = loanSchedule
        .filter((i) => i.id !== installment.id && i.status !== 'PAID' && filter.from && i.dueDate < filter.from)
        .reduce(
          (sum, i) =>
            sum +
            Number(i.principalDue) - Number(i.principalPaid) +
            (Number(i.interestDue) - Number(i.interestPaid)) +
            (effectiveFees(i) - Number(i.feesPaid)) +
            (effectivePenalty(i) - Number(i.penaltyPaid)),
          0,
        );

      return {
        clientName: `${installment.loanAccount.borrower.firstName} ${installment.loanAccount.borrower.lastName}`,
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        mobileNumber: installment.loanAccount.borrower.mobilePhone1 ?? '',
        accountState: installment.loanAccount.status,
        dueDate: installment.dueDate,
        maturityDate,
        lastPaidDate: installment.lastPaidAt,
        principalDue: installment.principalDue.toString(),
        interestDue: installment.interestDue.toString(),
        principalPaid: installment.principalPaid.toString(),
        interestPaid: installment.interestPaid.toString(),
        monthDue: (Number(installment.principalDue) + Number(installment.interestDue)).toFixed(2),
        pastDueAmount: Math.max(0, pastDueAmount).toFixed(2),
        daysLate: daysLateOf(installment.dueDate, today),
        repayment: (
          Number(installment.principalPaid) + Number(installment.interestPaid) + Number(installment.feesPaid) + Number(installment.penaltyPaid)
        ).toFixed(2),
        state: INSTALLMENT_STATUS_LABEL[installment.status] ?? installment.status,
      };
    });
  }

  /** Always installment #1 of every ACTIVE* loan, optionally date-filtered on that installment's own due date. */
  async getFirstAmortizationReport(filter: DateRangeFilter & { branchId?: string }): Promise<FirstAmortizationReportRow[]> {
    const firstInstallments = await prisma.repaymentSchedule.findMany({
      where: {
        installmentNumber: 1,
        dueDate: entryDateFilter(filter),
        loanAccount: {
          status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
          ...(filter.branchId ? { branchId: filter.branchId } : {}),
        },
      },
      include: { loanAccount: { include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } } } },
      orderBy: { dueDate: 'asc' },
    });

    return firstInstallments.map((installment) => {
      const penalty = effectivePenalty(installment);
      const fees = effectiveFees(installment);
      const obligation = Number(installment.principalDue) + Number(installment.interestDue) + fees + penalty;
      const payment =
        Number(installment.principalPaid) + Number(installment.interestPaid) + Number(installment.feesPaid) + Number(installment.penaltyPaid);

      return {
        clientName: `${installment.loanAccount.borrower.firstName} ${installment.loanAccount.borrower.lastName}`,
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        accountState: installment.loanAccount.status,
        firstAmortizationDate: installment.dueDate,
        principalDue: installment.principalDue.toString(),
        interestDue: installment.interestDue.toString(),
        feesDue: fees.toFixed(2),
        penaltyDue: penalty.toFixed(2),
        obligation: obligation.toFixed(2),
        payment: payment.toFixed(2),
        lastDatePaid: installment.lastPaidAt,
        repaymentState: INSTALLMENT_STATUS_LABEL[installment.status] ?? installment.status,
      };
    });
  }

  /** One row per `LoanTransaction` in range (every type, not just REPAYMENT - the legacy sample has
   * a "Type" column). Channel = the newly-persisted `paymentMethod` (§0 of this feature). */
  async getDailyCollectionReport(filter: DateRangeFilter & { branchId?: string }): Promise<DailyCollectionReportRow[]> {
    const transactions = await prisma.loanTransaction.findMany({
      where: {
        entryDate: entryDateFilter(filter),
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { loanAccount: { include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } } } },
      orderBy: { entryDate: 'desc' },
    });
    if (transactions.length === 0) return [];

    const loanIds = [...new Set(transactions.map((t) => t.loanAccountId))];
    const schedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'desc' } });
    const maturityByLoanId = new Map<string, Date>();
    for (const installment of schedule) {
      if (!maturityByLoanId.has(installment.loanAccountId)) maturityByLoanId.set(installment.loanAccountId, installment.dueDate);
    }

    return transactions.map((transaction) => ({
      fullName: `${transaction.loanAccount.borrower.firstName} ${transaction.loanAccount.borrower.lastName}`,
      productId: transaction.loanAccount.loanProductVersion.loanProduct.code,
      accountId: transaction.loanAccount.loanCode,
      totalBalance: transaction.balanceAfter.toString(),
      amount: transaction.amount.toString(),
      principalAmount: transaction.principalComponent.toString(),
      interestAmount: transaction.interestComponent.toString(),
      feesAmount: transaction.feesComponent.toString(),
      penaltyAmount: transaction.penaltyComponent.toString(),
      expectedMaturityDate: maturityByLoanId.get(transaction.loanAccountId) ?? null,
      valueDate: transaction.entryDate,
      orNumber: transaction.orNumber ?? '',
      arNumber: transaction.arNumber ?? '',
      channel: transaction.paymentMethod ? (PAYMENT_METHOD_LABEL[transaction.paymentMethod] ?? transaction.paymentMethod) : '',
      type: TRANSACTION_TYPE_LABEL[transaction.type] ?? transaction.type,
    }));
  }

  /** As-of-today snapshot: every loan the system considers fully paid (CLOSED - excludes
   * CLOSED_WRITTEN_OFF/CLOSED_REJECTED, same "fully paid" semantics `isFullyPaid`/`reopen()` already use). */
  async getFullyPaidAccountsReport(filter: { branchId?: string }): Promise<FullyPaidAccountsReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: 'CLOSED',
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } },
      orderBy: { closedAt: 'desc' },
    });
    if (loans.length === 0) return [];

    const loanIds = loans.map((loan) => loan.id);
    const schedule = await prisma.repaymentSchedule.findMany({
      where: { loanAccountId: { in: loanIds } },
      orderBy: { installmentNumber: 'desc' },
    });
    const maturityByLoanId = new Map<string, Date>();
    for (const installment of schedule) {
      if (!maturityByLoanId.has(installment.loanAccountId)) maturityByLoanId.set(installment.loanAccountId, installment.dueDate);
    }

    return loans.map((loan) => ({
      clientName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      product: loan.loanProductVersion.loanProduct.name,
      productId: loan.loanProductVersion.loanProduct.code,
      accountId: loan.loanCode,
      loanAmount: loan.principalAmount.toString(),
      maturityDate: maturityByLoanId.get(loan.id) ?? null,
      fullyPaidDate: loan.closedAt,
    }));
  }
}

/** Same "first address on file, comma-joined" convention as `LoanDocumentMergeDataResolver.formatAddress` / `ClientProfilePage.tsx`'s `existingAddressLine`. */
function formatAddress(address: { houseUnitNumber?: string | null; street?: string | null; barangay?: string | null; cityMunicipality?: string | null; province?: string | null } | undefined): string {
  if (!address) return '';
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
