import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { isSecMc3Covered } from '@shared/domain/compliance/SecMc3Coverage';
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

/**
 * 2026-08-03 (user-confirmed, "sa ngayon baguhin mo muna"): SDevTech's own "Accounts with Past
 * Due" report live-recomputes penalty as-of-today even for migrated loans, so this report must do
 * the same to reconcile against it - a deliberate, report-local override of `CurrentPenaltyResolver`
 * / ADR-050 §5's "prospective-only" scope (forcing `isProspectiveLoan: true` here does not touch the
 * loan's real `legacyId`/status). Every OTHER consumer of a migrated loan's penalty - the ledger,
 * `LoanAccount.balances`, Reduce Penalty's ceiling, other reports - keeps reading the frozen
 * `penaltyDue` snapshot exactly as before; only this report's displayed figure goes live, and it
 * reuses the exact same `resolveComputedPenalty` formula every other live-penalty consumer already
 * uses rather than re-deriving ADR-050 a second time.
 */
function liveEffectivePenalty(
  installment: {
    principalDue: Prisma.Decimal;
    interestDue: Prisma.Decimal;
    principalPaid: Prisma.Decimal;
    interestPaid: Prisma.Decimal;
    penaltyDue: Prisma.Decimal;
    penaltyOverrideAmount: Prisma.Decimal | null;
    status: string;
    dueDate: Date;
  },
  context: Omit<PenaltyComputationContext, 'isProspectiveLoan'>,
  asOfDate: Date,
): number {
  if (installment.penaltyOverrideAmount !== null) return Number(installment.penaltyOverrideAmount);

  const adapter = {
    due: InstallmentAmounts.of({
      principal: Money.of(installment.principalDue),
      interest: Money.of(installment.interestDue),
      penalty: Money.of(installment.penaltyDue),
    }),
    paid: InstallmentAmounts.of({
      principal: Money.of(installment.principalPaid),
      interest: Money.of(installment.interestPaid),
    }),
    status: installment.status,
    dueDate: installment.dueDate,
  } as unknown as RepaymentInstallment;

  return Number(resolveComputedPenalty(adapter, { ...context, isProspectiveLoan: true }, asOfDate).toString());
}

function daysLateOf(dueDate: Date, today: Date): number {
  const late = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
  return late > 0 ? late : 0;
}

/**
 * 2026-08-04 (user-confirmed, found via a real case - WILLFORD COMETA's SML-MAX_Q1H0Q showing
 * "08/04/2020" on the Ending Balance report but "August 5, 2020" everywhere else in the LMS):
 * `RepaymentSchedule.dueDate` for a migrated loan is stored as Asia/Manila midnight encoded as a
 * UTC instant (e.g. "2020-08-04T16:00:00.000Z" = August 5 00:00 PHT) - a correct UTC timestamp,
 * but ExcelJS (and this container, which runs in UTC) reads the UTC calendar day back out,
 * landing one day earlier than the Manila calendar day every other part of the LMS shows (a
 * browser's local-timezone rendering). A native (non-migrated) loan's dueDate is stored at UTC
 * midnight (`ActivateLoanUseCase`'s `addMonths`), so +8h never crosses into the next UTC day
 * there either - safe for both.
 *
 * Deliberately ONLY applied where a `RepaymentSchedule.dueDate` is written out as a REPORT
 * CELL (Due Date / Maturity Date columns) - never at a `daysLateOf()`/live-penalty call site,
 * which must keep comparing the raw, unshifted instant. This is a display-only correction, not a
 * change to any stored value or financial calculation.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
function toReportCalendarDate(date: Date | null | undefined): Date | null {
  return date ? new Date(date.getTime() + MANILA_OFFSET_MS) : null;
}

/** Same as `toReportCalendarDate`, for the report columns sourced from a `RepaymentSchedule.dueDate` that's never null (the installment always exists). */
function toReportCalendarDateRequired(date: Date): Date {
  return new Date(date.getTime() + MANILA_OFFSET_MS);
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

/** 2026-08-04 (user-confirmed): "First Middle Last" - matches SDevTech's own "Detailed Ending
 * Current Balance" export convention (e.g. "YASMIN KATRINA DELFIN SACLAO"). `middleName` is
 * optional on `Borrower` (not every borrower has one on file) - omitted entirely rather than
 * leaving a double space when absent. */
function formatFullName(borrower: { firstName: string; middleName: string | null; lastName: string }): string {
  return [borrower.firstName, borrower.middleName, borrower.lastName].filter(Boolean).join(' ');
}

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
        clientName: formatFullName(loan.borrower),
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
        // 2026-08-04 (user-confirmed): penalty excluded - found via direct comparison against
        // SDevTech's own Aging Report, whose bucket/Total figures match `accountingBalance`
        // (principal+interest+fees, no penalty), not `collectionsBalance` (which is correctly
        // penalty-inclusive per ADR-007, just not what this report shows). Including penalty here
        // roughly doubled the grand total (₱130M vs SDevTech's ₱67M) for old migrated loans with a
        // large accrued penaltyDue.
        const remaining =
          Number(installment.principalDue) - Number(installment.principalPaid) +
          (Number(installment.interestDue) - Number(installment.interestPaid)) +
          (effectiveFees(installment) - Number(installment.feesPaid));
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
        clientName: formatFullName(loan.borrower),
        product: loan.loanProductVersion.loanProduct.name,
        accountId: loan.loanCode,
        state: loan.status,
        maturityDate: toReportCalendarDate(maturityDate),
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
   * the legacy sample's column set (no penalty column on this report).
   *
   * 2026-08-04 (user-confirmed): CLOSED/written-off/restructured/adjusted accounts excluded - found
   * via direct comparison against SDevTech's own "Detailed Ending Current Balance" export, which
   * never lists a closed or zero-balance account (a report titled "ending CURRENT balance" has
   * nothing meaningful to say about a loan with no balance left). Previously including the whole
   * CLOSED_* family inflated this report to 1,788 rows against SDevTech's 1,277 - 623 of those extra
   * LMS rows had zero Total Obligation. */
  async getEndingBalanceReport(filter: { branchId?: string }): Promise<EndingBalanceReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
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
      clientName: formatFullName(loan.borrower),
      product: loan.loanProductVersion.loanProduct.name,
      loanAccountId: loan.loanCode,
      loanAmount: loan.principalAmount.toString(),
      principalBalance: loan.principalBalance.toString(),
      interestBalance: loan.interestBalance.toString(),
      feesBalance: loan.feesBalance.toString(),
      totalObligation: (Number(loan.principalBalance) + Number(loan.interestBalance) + Number(loan.feesBalance)).toFixed(2),
      maturityDate: toReportCalendarDate(maturityByLoanId.get(loan.id)),
      termRate: `${loan.installmentCount} Month/s`,
      interestRate: loan.interestRate.toString(),
      accountState: loan.status,
    }));
  }

  /** As-of-today snapshot: only loans with the oldest unpaid installment currently overdue.
   * CURRENT AMOUNT DUE / REPAYMENT / LACK-EXCESS are the reported (current-cycle) installment's
   * total due, total paid, and their difference. PAST AMOUNT DUE is the account's total arrears -
   * every overdue unpaid installment as of today, not just the reported one (see 2026-08-03 note
   * below) - so it only equals Current when the account has exactly one overdue installment. */
  async getAccountsWithPastDueReport(filter: DateRangeFilter & { branchId?: string }): Promise<AccountsWithPastDueReportRow[]> {
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
      if (unpaid.length === 0) continue;
      // 2026-08-03 (user-confirmed, verified directly against the live SDevTech UI): SDevTech's
      // own report prompts for a start/end date - previously assumed "as-of-today, no filter"
      // from an old static sample file that had no date columns, which was wrong for this report.
      // Without this, every unpaid installment ever migrated stayed in scope forever, including
      // ones from as far back as 2012.
      //
      // 2026-08-03 follow-up fix #1 (user-reported): checking only the OVERALL oldest unpaid
      // installment's due date against the range wrongly excluded an account whose delinquency
      // started earlier but also has a MORE RECENT unpaid installment inside the selected range
      // (e.g. oldest unpaid is June, but July is unpaid too and the user filtered on July).
      //
      // 2026-08-03 follow-up fix #2 (same report, re-verified against SDevTech afterward): fix #1
      // widened eligibility but still built the row from the OVERALL oldest unpaid installment,
      // so an account admitted only because of its July installment kept showing June's figures -
      // wrong Current/Past Amount Due, Days Late, Repayment State. The reported installment must
      // be the oldest unpaid installment THAT IS ITSELF within the filter range (falls back to the
      // overall oldest when no range is given, matching the un-filtered behavior).
      const inRange = (d: Date) => (!filter.from || d >= filter.from) && (!filter.to || d <= filter.to);
      const hasRangeFilter = Boolean(filter.from || filter.to);
      // 2026-08-03 bug fix (found while investigating why the date filter above appeared to do
      // nothing at all - it was still returning all 1206 unfiltered rows): fix #2's `?? unpaid[0]!`
      // fallback silently readmitted every account whose unpaid installments simply didn't include
      // one in range, since `Array.find` returning undefined always fell through to it - this
      // eligibility gate never got reinstated after fix #1's version of it was replaced.
      if (hasRangeFilter && !unpaid.some((i) => inRange(i.dueDate))) continue;
      const reported = (hasRangeFilter ? unpaid.find((i) => inRange(i.dueDate)) : undefined) ?? unpaid[0]!;
      const daysLate = daysLateOf(reported.dueDate, today);
      if (daysLate === 0) continue;

      const originationDate = loan.activatedAt ?? loan.anticipatedDisbursementDate ?? loan.firstRepaymentDate;
      const livePenaltyContext: Omit<PenaltyComputationContext, 'isProspectiveLoan'> = {
        principalAmount: Money.of(loan.principalAmount),
        isSecMc3Covered: isSecMc3Covered({
          principalAmount: Money.of(loan.principalAmount),
          installmentCount: loan.installmentCount,
          isUnsecuredGeneralPurpose: loan.loanProductVersion.loanProduct.isUnsecuredGeneralPurpose,
          originationDate,
        }),
        maturityDate: maturityDate ?? today,
      };
      const penalty = liveEffectivePenalty(reported, livePenaltyContext, today);
      const amountDue = Number(reported.principalDue) + Number(reported.interestDue) + effectiveFees(reported) + penalty;
      // 2026-08-03 (user-confirmed): "Past Amount Due" is the account's TOTAL arrears - every
      // overdue unpaid installment as of today, not just the one `reported` row (which drives Due
      // Date/Days Late/Repayment State and represents only the CURRENT cycle). Previously this
      // column was a copy of `amountDue`, so it silently matched Current for every account
      // regardless of how many months were actually unpaid; found via a real case (SL-CORP_00090
      // etc.) with 2 overdue unpaid installments where the two figures should differ. Falls back to
      // `amountDue` when `reported` is the only overdue installment, matching the user's own
      // expectation ("dapat magkapareho lang kung 1 buwan lang ang late").
      const overdueUnpaid = installments.filter((i) => i.status !== 'PAID' && i.dueDate < today);
      const pastAmountDue = overdueUnpaid.reduce((sum, installment) => {
        const installmentPenalty = installment.id === reported.id ? penalty : liveEffectivePenalty(installment, livePenaltyContext, today);
        return sum + Number(installment.principalDue) + Number(installment.interestDue) + effectiveFees(installment) + installmentPenalty;
      }, 0);
      const repayment =
        Number(reported.principalPaid) + Number(reported.interestPaid) + Number(reported.feesPaid) + Number(reported.penaltyPaid);
      const lastPaid = [...installments].filter((i) => i.lastPaidAt).sort((a, b) => b.lastPaidAt!.getTime() - a.lastPaidAt!.getTime())[0];

      rows.push({
        clientName: formatFullName(loan.borrower),
        product: loan.loanProductVersion.loanProduct.name,
        accountId: loan.loanCode,
        accountState: loan.status,
        dueDate: toReportCalendarDateRequired(reported.dueDate),
        maturityDate: toReportCalendarDate(maturityDate),
        lastPaidDate: lastPaid?.lastPaidAt ?? null,
        currentAmountDue: amountDue.toFixed(2),
        pastAmountDue: pastAmountDue.toFixed(2),
        daysLate,
        repayment: repayment.toFixed(2),
        lackOrExcess: (amountDue - repayment).toFixed(2),
        repaymentState: INSTALLMENT_STATUS_LABEL[reported.status] ?? reported.status,
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
      // 2026-08-03 (user-confirmed): penalty excluded from Amount Due here - found via direct
      // comparison against SDevTech's own "Collection" export, where several already-fully-repaid
      // (principal+interest+fees) installments still carry a leftover `penaltyDue` (e.g.
      // SML-REG_00322 #4: 5,300.54, an exact duplicate of installment #3's already-paid penalty -
      // looks like a migration mis-attribution), inflating Amount Due above what SDevTech shows and
      // above what was actually collected, even though the installment is legitimately "Paid".
      // `penaltyPaid` is dropped from Repayment for the same reason - so the two figures stay
      // apples-to-apples (both cover principal/interest/fees only) rather than Repayment including
      // a penalty component Amount Due no longer does.
      const amountDue = Number(installment.principalDue) + Number(installment.interestDue) + effectiveFees(installment);
      const repayment = Number(installment.principalPaid) + Number(installment.interestPaid) + Number(installment.feesPaid);

      return {
        clientName: formatFullName(installment.loanAccount.borrower),
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        dueDate: toReportCalendarDateRequired(installment.dueDate),
        maturityDate: toReportCalendarDate(maturityDate),
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
      // 2026-08-03 (user-confirmed business rule, via a SDevTech vs LMS report comparison):
      // principal + interest shortfall only - deliberately excludes fees/penalty. Matches
      // SDevTech's own "Past Due Amount" convention exactly (confirmed against 6 loans where the
      // two disagreed): fees/penalty are tracked and collected separately, never folded into this
      // figure. Previously included fees/penalty, which let an overpaid penalty on one installment
      // silently cancel out a real unpaid principal/interest shortfall in the total.
      const pastDueAmount = loanSchedule
        .filter((i) => i.id !== installment.id && i.status !== 'PAID' && filter.from && i.dueDate < filter.from)
        .reduce((sum, i) => sum + (Number(i.principalDue) - Number(i.principalPaid)) + (Number(i.interestDue) - Number(i.interestPaid)), 0);

      return {
        clientName: formatFullName(installment.loanAccount.borrower),
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        mobileNumber: installment.loanAccount.borrower.mobilePhone1 ?? '',
        accountState: installment.loanAccount.status,
        dueDate: toReportCalendarDateRequired(installment.dueDate),
        maturityDate: toReportCalendarDate(maturityDate),
        lastPaidDate: installment.lastPaidAt,
        principalDue: installment.principalDue.toString(),
        interestDue: installment.interestDue.toString(),
        principalPaid: installment.principalPaid.toString(),
        interestPaid: installment.interestPaid.toString(),
        // 2026-08-03 (user-reported, same SDevTech comparison as pastDueAmount above): this must
        // be the REMAINING unpaid amount for this installment (0 once fully paid), not the static
        // principal+interest due - a paid installment was showing its full original due amount
        // here instead of 0, matching every case where SDevTech's own figure differed.
        monthDue: (
          Number(installment.principalDue) -
          Number(installment.principalPaid) +
          (Number(installment.interestDue) - Number(installment.interestPaid))
        ).toFixed(2),
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
        clientName: formatFullName(installment.loanAccount.borrower),
        product: installment.loanAccount.loanProductVersion.loanProduct.name,
        accountId: installment.loanAccount.loanCode,
        accountState: installment.loanAccount.status,
        firstAmortizationDate: toReportCalendarDateRequired(installment.dueDate),
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
      fullName: formatFullName(transaction.loanAccount.borrower),
      productId: transaction.loanAccount.loanProductVersion.loanProduct.code,
      accountId: transaction.loanAccount.loanCode,
      totalBalance: transaction.balanceAfter.toString(),
      amount: transaction.amount.toString(),
      principalAmount: transaction.principalComponent.toString(),
      interestAmount: transaction.interestComponent.toString(),
      feesAmount: transaction.feesComponent.toString(),
      penaltyAmount: transaction.penaltyComponent.toString(),
      expectedMaturityDate: toReportCalendarDate(maturityByLoanId.get(transaction.loanAccountId)),
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
      clientName: formatFullName(loan.borrower),
      product: loan.loanProductVersion.loanProduct.name,
      productId: loan.loanProductVersion.loanProduct.code,
      accountId: loan.loanCode,
      loanAmount: loan.principalAmount.toString(),
      maturityDate: toReportCalendarDate(maturityByLoanId.get(loan.id)),
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
