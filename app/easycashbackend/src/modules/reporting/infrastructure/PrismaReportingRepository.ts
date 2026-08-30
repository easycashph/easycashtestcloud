import { Prisma, type PortalAccountStatus } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { isSecMc3Covered } from '@shared/domain/compliance/SecMc3Coverage';
import { isDueDatePast } from '@shared/utils/dueDateGrace';
import type {
  AccountsWithPastDueReportRow,
  AgingReportRow,
  ChannelOption,
  CicContractRow,
  CicIndividualRow,
  CicMonthlyReportData,
  CicMonthlyReportFilter,
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
  LoanReleaseOrigin,
  LoanReleaseReportRow,
  OriginationReportRow,
  PortalAccountReportRow,
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

/**
 * Mirrors frontend `staticConfig.ts`'s `ACTIVE_PAYMENT_METHODS`/`DISCONTINUED_PAYMENT_METHODS`
 * codes - small intentional duplication (display-label mapping only) rather than a cross-package
 * import.
 *
 * 2026-08-15 (found comparing LMS/SDevTech Daily Collection Reports): `ProcessPaymentUseCase`
 * stores a native payment's channel as the raw uppercase CODE (e.g. "BANK_TRANSFER"), while
 * migrated SDevTech transactions store their own already-readable channel name (e.g.
 * "Bank Transfer") verbatim. Left unmapped, a code fell through this lookup's `?? value` fallback
 * unresolved, so the same real-world channel showed as two different strings depending on which
 * system recorded it - both in the `channel` report column and, worse, as two separate-looking
 * checkboxes in the channel filter dropdown once that existed. Every code below is mapped to
 * exactly the label its migrated counterpart already uses in the database (verified via a live
 * query, not guessed), so both forms resolve to one canonical label and `listDistinctChannels()`
 * can merge them into a single filter option. Codes with no current migrated counterpart (e.g.
 * GCASH, the discontinued ones) just get their own natural label.
 */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  GCASH: 'GCash',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  PDC: 'Post Dated Checks',
  RESTRUCTURE: 'Restructured',
  SUSPENSE_ACCOUNT: 'Suspense Account',
  ADA: 'ADA',
  UNEARNED_INCOME: 'Unearned Income',
  ADJUSTMENT: 'Adjustment',
  BANK: 'Bank',
  RECEIPT: 'Receipt',
  CHECK: 'Check',
  LOAN_DEDUCT: 'Loan Deduct',
  ATM: 'ATM',
  AUTO_DEBIT: 'Auto Debit',
  DRAGONPAY: 'Dragonpay',
  ECPAY: 'ECPay',
  BAYAD_CENTER: 'Bayad Center',
  LBC: 'LBC',
  WESTERN_UNION: 'Western Union',
  PALAWAN_PAWNSHOP: 'Palawan Pawnshop',
};

/**
 * 2026-08-15 (user request): mirrors frontend `staticConfig.ts`'s `ACTIVE_PAYMENT_METHODS` codes -
 * the channels currently offered on Record Payment, whether or not any transaction has used them
 * yet (e.g. GCash: offered, zero transactions so far). `listDistinctChannels()` unions these into
 * its result so the filter dropdown shows every real option, not just ones with history - a
 * channel with no transactions still appears, just with an empty `values` array (nothing to
 * actually filter by yet, but visible and selectable). Deliberately excludes
 * `DISCONTINUED_PAYMENT_METHODS` - those aren't offered going forward, so they only appear here at
 * all if a migrated/native transaction already used one (e.g. "Dragonpay").
 */
const ACTIVE_PAYMENT_METHOD_CODES = [
  'GCASH',
  'CASH',
  'BANK_TRANSFER',
  'PDC',
  'RESTRUCTURE',
  'SUSPENSE_ACCOUNT',
  'ADA',
  'UNEARNED_INCOME',
  'ADJUSTMENT',
  'BANK',
  'RECEIPT',
  'CHECK',
  'LOAN_DEDUCT',
  'ATM',
];

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
  // 2026-08-15: migrated SDevTech history only. Labels match SDevTech's own Daily Collection
  // Report wording exactly, so the two systems' reports can be compared line for line during the
  // changeover — that comparison is how these were found mislabelled as "Adjustment".
  FEE_REPAYMENT: 'Fee Repayment',
  PENALTY_REPAYMENT: 'Penalty Repayment',
};

/** 2026-08-04 (user-confirmed): "First Middle Last" - matches SDevTech's own "Detailed Ending
 * Current Balance" export convention (e.g. "YASMIN KATRINA DELFIN SACLAO"). `middleName` is
 * optional on `Borrower` (not every borrower has one on file) - omitted entirely rather than
 * leaving a double space when absent. */
function formatFullName(borrower: { firstName: string; middleName: string | null; lastName: string }): string {
  return [borrower.firstName, borrower.middleName, borrower.lastName].filter(Boolean).join(' ');
}

/** CivilStatusDomain (2026-08-30, from the official CIC submission manual §7.1.4) - covers the
 * variants actually stored in `Borrower.civilStatus` (free text). Blank for anything unrecognized,
 * never guessed. */
function cicCivilStatusCode(civilStatus: string | null): string {
  const v = (civilStatus ?? '').trim().toUpperCase();
  if (v === 'SINGLE') return '1';
  if (v === 'MARRIED') return '2';
  if (v === 'DIVORCED' || v === 'SEPARATED' || v === 'DIVORCED/SEPARATED') return '3';
  if (v === 'WIDOW' || v === 'WIDOWED') return '4';
  return '';
}

/** OccupationStatusDomain (manual §7.1.11). Only 'Self Employed' maps confidently - see
 * `CicIndividualRow.occupationStatusCode`'s own doc comment for why plain 'Employed' doesn't. */
function cicOccupationStatusCode(employmentType: string | null): string {
  const v = (employmentType ?? '').trim().toUpperCase();
  if (v === 'SELF EMPLOYED' || v === 'SELF-EMPLOYED') return '5';
  return '';
}

/** IdentificationTypeDomain (§7.1.6, TIN/SSS/GSIS/Philhealth/UMID/business-registration) and
 * IDTypeDomain (§7.1.7, government photo IDs) both draw from the same
 * `IdentificationDocument.documentType` free-text field in this system - classified into whichever
 * CIC domain it actually belongs to. Normalizes the real variants found in this system's data
 * (`Tin ID` vs `Tax Identification Number` vs `TIN`, etc). Unrecognized values are left blank. */
/** IDTypeDomain (§7.1.7, government photo IDs) - a DIFFERENT, non-mandatory field group from the
 * TIN/SSS "Identification" fields (those come from `BorrowerGovernmentId`'s structured columns
 * instead, see `CicIndividualRow.tin`/`.sss`'s own doc comment). Normalizes the real spelling
 * variants found in this system's `IdentificationDocument.documentType` data. */
function cicIdType(documentType: string | null): string {
  const v = (documentType ?? '').trim().toUpperCase();
  const idType: Record<string, string> = {
    "DRIVER'S LICENSE": '10',
    'DRIVERS LICENSE': '10',
    "VOTER'S ID": '11',
    "VOTER'S": '11',
    VOTERS: '11',
    'VOTERS ID': '11',
    PASSPORT: '12',
    'PRC ID': '13',
    'PROFESSIONAL REGULATION COMMISSION': '13',
    NBI: '14',
    'POSTAL ID': '16',
    POSTAL: '16',
    'POSTAL IDENTITY CARD': '16',
    'SEAMANS BOOK': '20',
    "SEAMAN'S BOOK": '20',
    'NATIONAL ID': '32',
  };
  return idType[v] ?? '';
}

/** InstallmentContractTypeDomain (CIC field-spec Excel's own "CI - Installment Contract" domain
 * sheet). Prefix-based, user-confirmed 2026-08-30 - see `CicContractRow.contractTypeCode`'s own
 * doc comment for the exact mapping and which prefixes are still unmapped. */
function cicContractTypeCode(productCode: string): string {
  const v = productCode.toUpperCase();
  if (v.startsWith('SL-')) return '20'; // Salary Loan
  if (v.startsWith('BL-')) return '22'; // Business Loan
  if (v.startsWith('PL-') || v.startsWith('PFL-') || v.startsWith('SML')) return '12'; // Personal Loan
  if (v.startsWith('CL-')) return '12'; // Personal Loan
  if (v.startsWith('SP-')) return '20'; // Salary Loan - user-confirmed 2026-08-30 (SP-Easy/SP-Flash)
  return '';
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
    // 2026-08-15: `= ANY(...)` rather than a single `=` — the filter is multi-select now (see
    // ListReportTransactionsOptions.types). Cast the whole array, not each element, so this stays a
    // single bound parameter regardless of how many types are selected.
    const typeClause =
      options.types && options.types.length > 0
        ? Prisma.sql`AND lt."type" = ANY(${options.types}::"LoanTransactionType"[])`
        : Prisma.empty;
    // 2026-08-15 (multi-select channel filter): matches the raw stored paymentMethod value exactly
    // - see ListReportTransactionsOptions.channels' own doc comment.
    const channelClause =
      options.channels && options.channels.length > 0 ? Prisma.sql`AND lt."paymentMethod" = ANY(${options.channels}::text[])` : Prisma.empty;
    const branchClause = options.branchId ? Prisma.sql`AND lt."branchId" = ${options.branchId}` : Prisma.empty;
    const fromClause = range?.gte ? Prisma.sql`AND lt."entryDate" >= ${range.gte}` : Prisma.empty;
    const toClause = range?.lte ? Prisma.sql`AND lt."entryDate" <= ${range.lte}` : Prisma.empty;
    const cursorClause = options.cursor
      ? Prisma.sql`AND (DATE(lt."entryDate"), lt."createdAt", lt.id) < (
          SELECT DATE(c."entryDate"), c."createdAt", c.id FROM loan_transactions c WHERE c.id = ${options.cursor}
        )`
      : Prisma.empty;

    // 2026-08-15: a transaction that has already been reversed (TXN-1: the original row is never
    // edited or deleted, a REVERSAL row is created alongside it — see ReversePaymentUseCase) no
    // longer represents real activity: its net effect on the loan is zero. Left in, it silently
    // double-counted every reversed payment in "Payments only" report views, since REVERSAL is
    // deliberately not one of the default payment types (found comparing the LMS's and SDevTech's
    // Daily Collection Reports — every one of the 15 duplicate payments reversed on 2026-08-12 was
    // still showing up here as if collected). Unconditional, not tied to the type filter: a
    // REVERSAL transaction is never itself reversed (nothing points a `reversesTransactionId` at
    // it), so this only ever excludes the reversed original, and the REVERSAL row itself stays
    // visible when its own type is selected — the correction is still fully auditable, just not
    // double-counted as revenue.
    const notReversedClause = Prisma.sql`AND NOT EXISTS (SELECT 1 FROM loan_transactions r WHERE r."reversesTransactionId" = lt.id)`;

    const orderedIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT lt.id
      FROM loan_transactions lt
      WHERE 1=1
      ${typeClause}
      ${channelClause}
      ${branchClause}
      ${fromClause}
      ${toClause}
      ${cursorClause}
      ${notReversedClause}
      ORDER BY DATE(lt."entryDate") DESC, lt."createdAt" DESC, lt.id DESC
      LIMIT ${options.limit}
    `);

    if (orderedIds.length === 0) return [];

    const found = await prisma.loanTransaction.findMany({
      where: { id: { in: orderedIds.map((r) => r.id) } },
      include: {
        loanAccount: { include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } } },
        branch: { select: { name: true } },
      },
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    const rows = orderedIds.map((r) => byId.get(r.id)!);

    // 2026-08-05 (user-confirmed): same maturity-date lookup `getDailyCollectionReport` already
    // does, reused here so both reports agree on Expected Maturity Date for the same loan.
    const loanIds = [...new Set(rows.map((row) => row.loanAccountId))];
    const schedule = await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'desc' } });
    const maturityByLoanId = new Map<string, Date>();
    for (const installment of schedule) {
      if (!maturityByLoanId.has(installment.loanAccountId)) maturityByLoanId.set(installment.loanAccountId, installment.dueDate);
    }

    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      loanCode: row.loanAccount.loanCode,
      borrowerName: formatFullName(row.loanAccount.borrower),
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
      productId: row.loanAccount.loanProductVersion.loanProduct.code,
      totalBalance: row.balanceAfter.toString(),
      expectedMaturityDate: toReportCalendarDate(maturityByLoanId.get(row.loanAccountId)),
      orNumber: row.orNumber ?? '',
      arNumber: row.arNumber ?? '',
      channel: row.paymentMethod ? (PAYMENT_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod) : '',
    }));
  }

  /**
   * 2026-08-15 (multi-select channel filter, user request): the stored `paymentMethod` column
   * mixes migrated free-text channel names (e.g. "Loan Deduct", "Dragonpay") with native
   * ACTIVE_PAYMENT_METHODS codes (e.g. "BANK_TRANSFER") — there's no fixed enum to offer a filter
   * dropdown from, so this queries whatever values are actually in use right now and resolves each
   * one's display label the same way `channel` report columns already do.
   */
  async listDistinctChannels(): Promise<ChannelOption[]> {
    const rows = await prisma.loanTransaction.findMany({
      where: { paymentMethod: { not: null } },
      distinct: ['paymentMethod'],
      select: { paymentMethod: true },
    });

    // Grouped by resolved label, not returned one-per-raw-value - a native code (e.g.
    // "BANK_TRANSFER") and its migrated counterpart ("Bank Transfer") both resolve to the same
    // label via PAYMENT_METHOD_LABEL and must appear as ONE filter checkbox, not two identical-
    // looking ones (see that map's own doc comment for the full story).
    const valuesByLabel = new Map<string, string[]>();
    for (const row of rows) {
      const value = row.paymentMethod!;
      const label = PAYMENT_METHOD_LABEL[value] ?? value;
      if (!valuesByLabel.has(label)) valuesByLabel.set(label, []);
      valuesByLabel.get(label)!.push(value);
    }
    // 2026-08-15 (user request): union in every currently-offered channel even with zero
    // transactions so far (e.g. GCash) - see ACTIVE_PAYMENT_METHOD_CODES' own doc comment. A code
    // whose label already has DB-observed values (e.g. CASH -> "Cash") is a no-op here; only a
    // genuinely unused one gets an empty-`values` entry.
    for (const code of ACTIVE_PAYMENT_METHOD_CODES) {
      const label = PAYMENT_METHOD_LABEL[code] ?? code;
      if (!valuesByLabel.has(label)) valuesByLabel.set(label, []);
    }

    return [...valuesByLabel.entries()].map(([label, values]) => ({ label, values })).sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * 2026-08-29 (user request): a Restructure/Adjustment/Compromise Settlement each create a fresh
   * `LoanAccount` to carry an old loan's balance forward under new terms - no new money actually
   * goes out, so counting them as "releases" (their default behavior before this change)
   * overstated real disbursements. `origins` (default `['ORIGINATION']`) lets the caller choose
   * which of the four origin types to include; multiple selected origins are unioned together.
   */
  async getLoanReleasesReport(
    filter: DateRangeFilter & { branchId?: string; origins?: LoanReleaseOrigin[] },
  ): Promise<LoanReleaseReportRow[]> {
    const origins = filter.origins && filter.origins.length > 0 ? filter.origins : (['ORIGINATION'] as LoanReleaseOrigin[]);

    const [restructures, adjustments, compromises] = await Promise.all([
      prisma.loanRestructure.findMany({ select: { newLoanAccountId: true } }),
      prisma.loanAdjustment.findMany({ select: { newLoanAccountId: true } }),
      prisma.loanCompromiseSettlement.findMany({ select: { newLoanAccountId: true } }),
    ]);
    const restructureIds = new Set(restructures.map((r) => r.newLoanAccountId));
    const adjustmentIds = new Set(adjustments.map((a) => a.newLoanAccountId));
    const compromiseIds = new Set(compromises.map((c) => c.newLoanAccountId));

    function originOf(loanAccountId: string): LoanReleaseOrigin {
      if (restructureIds.has(loanAccountId)) return 'RESTRUCTURE';
      if (adjustmentIds.has(loanAccountId)) return 'ADJUSTMENT';
      if (compromiseIds.has(loanAccountId)) return 'COMPROMISE';
      return 'ORIGINATION';
    }

    const includeOrigination = origins.includes('ORIGINATION');
    const includeRestructure = origins.includes('RESTRUCTURE');
    const includeAdjustment = origins.includes('ADJUSTMENT');
    const includeCompromise = origins.includes('COMPROMISE');

    const allLoans = await prisma.loanAccount.findMany({
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
    const loans = allLoans.filter((loan) => {
      const origin = originOf(loan.id);
      if (origin === 'RESTRUCTURE') return includeRestructure;
      if (origin === 'ADJUSTMENT') return includeAdjustment;
      if (origin === 'COMPROMISE') return includeCompromise;
      return includeOrigination;
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
        origin: originOf(loan.id),
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
        // 2026-08-19 (user request, migration period): same kill-switch as every other
        // resolveComputedPenalty consumer — see CurrentPenaltyResolver.ts's own doc comment. This
        // report's whole point was to live-compute a figure that reconciles against SDevTech's own
        // live report, but ADR-050's generic 5%/10% formula doesn't reflect SDevTech's actual
        // per-loan penalty handling anyway (many products' penalty_calculation_method is "NONE"
        // there and are charged manually instead — see session log 2026-08-19), so while the LMS
        // and SDevTech run in parallel, this falls back to the same frozen `penaltyDue` snapshot
        // every other report already uses rather than a formula-based guess.
        autoComputeEnabled: env.PENALTY_AUTO_COMPUTE_ENABLED,
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
      // 2026-08-20 (user-reported, BL-SPEC_00028): grace through the FULL calendar day of the due
      // date - see dueDateGrace.ts's own doc comment. An installment due "today" isn't part of the
      // arrears total yet.
      const overdueUnpaid = installments.filter((i) => i.status !== 'PAID' && isDueDatePast(i.dueDate, today));
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
  async getExpectedCollectionReport(filter: DateRangeFilter & { branchId?: string; productCodes?: string[] }): Promise<ExpectedCollectionReportRow[]> {
    const range = entryDateFilter(filter);
    const installments = await prisma.repaymentSchedule.findMany({
      where: {
        dueDate: range,
        loanAccount: {
          status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
          ...(filter.branchId ? { branchId: filter.branchId } : {}),
          ...(filter.productCodes && filter.productCodes.length > 0
            ? { loanProductVersion: { loanProduct: { code: { in: filter.productCodes } } } }
            : {}),
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
   * a "Type" column). Channel = the newly-persisted `paymentMethod` (§0 of this feature).
   *
   * 2026-08-05 (user-confirmed): `types` narrows to the selected `LoanTransactionType`s when given -
   * the Transaction Report page's "Download report" button reuses this same endpoint, and must
   * only export what the on-screen type dropdown is currently filtered to, not everything.
   * 2026-08-15: widened from a single `type` to a list, matching the page's multi-select filter.
   */
  async getDailyCollectionReport(
    filter: DateRangeFilter & { branchId?: string; types?: string[]; channels?: string[] },
  ): Promise<DailyCollectionReportRow[]> {
    // 2026-08-15 (user-confirmed): this report mirrors SDevTech's own row structure, where a single
    // borrower payment is emitted as SEPARATE rows - principal+interest together as `Repayment`,
    // then fees as `Fee Repayment`, then penalty as `Penalty Repayment`. That layout is a business
    // requirement, not a cosmetic one: the report is consumed downstream for other purposes, which
    // is why the components can't be collapsed into one line.
    //
    // Storage is unchanged (TXN-1: one payment is still one `LoanTransaction` carrying all four
    // components) - only this report's presentation splits. Migrated FEE_REPAYMENT/PENALTY_REPAYMENT
    // rows already ARE separate transactions in SDevTech's own shape, so they pass through as-is and
    // are never split again.
    //
    // Because a native REPAYMENT can produce all three OUTPUT row types, the type filter has to be
    // applied to the emitted rows rather than to the stored transaction type - otherwise selecting
    // "Fee Repayment" would miss the fee portion of every natively-recorded payment. So the DB query
    // widens to include REPAYMENT whenever any payment type is selected, and the requested types are
    // re-applied after splitting.
    const requestedTypes = filter.types && filter.types.length > 0 ? new Set(filter.types) : null;
    const queryTypes = requestedTypes ? new Set(requestedTypes) : null;
    if (queryTypes && (queryTypes.has('FEE_REPAYMENT') || queryTypes.has('PENALTY_REPAYMENT'))) {
      queryTypes.add('REPAYMENT');
    }

    const transactions = await prisma.loanTransaction.findMany({
      where: {
        entryDate: entryDateFilter(filter),
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(queryTypes ? { type: { in: [...queryTypes] as never[] } } : {}),
        // 2026-08-15 (multi-select channel filter): channel is 1:1 per stored transaction (unlike
        // type, it's never split across the emitted rows above), so a plain `in` on the raw stored
        // value is sufficient here - no post-split re-filtering needed.
        ...(filter.channels && filter.channels.length > 0 ? { paymentMethod: { in: filter.channels } } : {}),
        // 2026-08-15: same fix and rationale as listTransactions' notReversedClause above - a
        // reversed transaction no longer represents real collected money and must not be
        // double-counted here just because its offsetting REVERSAL isn't in the selected types.
        reversedByTransaction: null,
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

    const rows: DailyCollectionReportRow[] = [];
    for (const transaction of transactions) {
      // Everything every emitted row shares - only the four amount columns and `type` differ.
      const base = {
        fullName: formatFullName(transaction.loanAccount.borrower),
        productId: transaction.loanAccount.loanProductVersion.loanProduct.code,
        accountId: transaction.loanAccount.loanCode,
        // One stored transaction has exactly one `balanceAfter`; SDevTech's genuinely-separate
        // transactions each carry their own running balance. Repeating it across a split payment's
        // rows is the honest option here - the intermediate balances were never recorded and would
        // have to be invented to fill in per-row.
        totalBalance: transaction.balanceAfter.toString(),
        expectedMaturityDate: toReportCalendarDate(maturityByLoanId.get(transaction.loanAccountId)),
        valueDate: transaction.entryDate,
        orNumber: transaction.orNumber ?? '',
        arNumber: transaction.arNumber ?? '',
        channel: transaction.paymentMethod ? (PAYMENT_METHOD_LABEL[transaction.paymentMethod] ?? transaction.paymentMethod) : '',
      };
      const ZERO = '0';

      // Only a natively-recorded REPAYMENT carries several components on one row and therefore
      // needs splitting. Every other type (including already-split migrated FEE_REPAYMENT/
      // PENALTY_REPAYMENT, and non-payment types like DISBURSEMENT) passes through unchanged.
      if (transaction.type === 'REPAYMENT') {
        const principalPlusInterest = transaction.principalComponent.add(transaction.interestComponent);
        // Skipped when zero so a fees-only or penalty-only payment doesn't emit an empty ₱0 row.
        if (!principalPlusInterest.isZero()) {
          rows.push({
            ...base,
            amount: principalPlusInterest.toString(),
            principalAmount: transaction.principalComponent.toString(),
            interestAmount: transaction.interestComponent.toString(),
            feesAmount: ZERO,
            penaltyAmount: ZERO,
            type: TRANSACTION_TYPE_LABEL.REPAYMENT!,
          });
        }
        if (!transaction.feesComponent.isZero()) {
          rows.push({
            ...base,
            amount: transaction.feesComponent.toString(),
            principalAmount: ZERO,
            interestAmount: ZERO,
            feesAmount: transaction.feesComponent.toString(),
            penaltyAmount: ZERO,
            type: TRANSACTION_TYPE_LABEL.FEE_REPAYMENT!,
          });
        }
        if (!transaction.penaltyComponent.isZero()) {
          rows.push({
            ...base,
            amount: transaction.penaltyComponent.toString(),
            principalAmount: ZERO,
            interestAmount: ZERO,
            feesAmount: ZERO,
            penaltyAmount: transaction.penaltyComponent.toString(),
            type: TRANSACTION_TYPE_LABEL.PENALTY_REPAYMENT!,
          });
        }
      } else {
        rows.push({
          ...base,
          amount: transaction.amount.toString(),
          principalAmount: transaction.principalComponent.toString(),
          interestAmount: transaction.interestComponent.toString(),
          feesAmount: transaction.feesComponent.toString(),
          penaltyAmount: transaction.penaltyComponent.toString(),
          type: TRANSACTION_TYPE_LABEL[transaction.type] ?? transaction.type,
        });
      }
    }

    // Re-apply the caller's type filter to the EMITTED rows (see this method's opening comment):
    // the DB query above was deliberately widened to include REPAYMENT so a native payment's fee/
    // penalty portions could be produced at all.
    if (!requestedTypes) return rows;
    const requestedLabels = new Set([...requestedTypes].map((t) => TRANSACTION_TYPE_LABEL[t] ?? t));
    return rows.filter((row) => requestedLabels.has(row.type));
  }

  /** As-of-today snapshot: every loan the system considers fully paid (CLOSED - excludes
   * CLOSED_WRITTEN_OFF/CLOSED_REJECTED, same "fully paid" semantics `isFullyPaid`/`reopen()` already use). */
  /**
   * 2026-08-04 (user-confirmed): date-filtered on Fully Paid Date (defaults to the current month
   * on the frontend, same convention as every other date-ranged report) - previously "as-of-today,
   * no filter" (like Accounts with Past Due used to be), which listed all 517 CLOSED loans ever,
   * against SDevTech's own report showing only 8 (its own report is date-scoped too).
   *
   * `closedAt` is null for 491 of those 517 loans - confirmed this is genuinely absent in
   * SDevTech's own source data too (`loan_accounts.closedDate`), not a migration bug. SDevTech's
   * own "Fully Paid Date" column turns out to be sourced from `lastModifiedDate`
   * (loan_accounts)/the last repayment's date instead when `closedDate` is absent - confirmed by
   * matching 3 sample loans' exact timestamps. Mirrors that here: falls back to the latest
   * `RepaymentSchedule.lastPaidAt` across the loan's own installments (real, already-migrated
   * data, not fabricated) whenever `closedAt` itself is null.
   */
  async getFullyPaidAccountsReport(filter: DateRangeFilter & { branchId?: string }): Promise<FullyPaidAccountsReportRow[]> {
    const loans = await prisma.loanAccount.findMany({
      where: {
        status: 'CLOSED',
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
    const latestPaidByLoanId = new Map<string, Date>();
    for (const installment of schedule) {
      if (!maturityByLoanId.has(installment.loanAccountId)) maturityByLoanId.set(installment.loanAccountId, installment.dueDate);
      if (installment.lastPaidAt) {
        const current = latestPaidByLoanId.get(installment.loanAccountId);
        if (!current || installment.lastPaidAt > current) latestPaidByLoanId.set(installment.loanAccountId, installment.lastPaidAt);
      }
    }

    const inRange = (d: Date) => (!filter.from || d >= filter.from) && (!filter.to || d <= filter.to);
    const hasRangeFilter = Boolean(filter.from || filter.to);

    const rows: FullyPaidAccountsReportRow[] = [];
    for (const loan of loans) {
      const effectiveClosedAt = loan.closedAt ?? latestPaidByLoanId.get(loan.id) ?? null;
      if (hasRangeFilter && (!effectiveClosedAt || !inRange(effectiveClosedAt))) continue;
      rows.push({
        clientName: formatFullName(loan.borrower),
        product: loan.loanProductVersion.loanProduct.name,
        productId: loan.loanProductVersion.loanProduct.code,
        accountId: loan.loanCode,
        loanAmount: loan.principalAmount.toString(),
        maturityDate: toReportCalendarDate(maturityByLoanId.get(loan.id)),
        fullyPaidDate: toReportCalendarDate(effectiveClosedAt),
      });
    }
    rows.sort((a, b) => (b.fullyPaidDate?.getTime() ?? 0) - (a.fullyPaidDate?.getTime() ?? 0));
    return rows;
  }

  async getPortalAccountsReport(filter: { search?: string; status?: string }): Promise<PortalAccountReportRow[]> {
    const accounts = await prisma.portalAccount.findMany({
      where: {
        ...(filter.status ? { status: filter.status as PortalAccountStatus } : {}),
        ...(filter.search
          ? {
              OR: [
                { email: { contains: filter.search, mode: 'insensitive' } },
                { firstName: { contains: filter.search, mode: 'insensitive' } },
                { lastName: { contains: filter.search, mode: 'insensitive' } },
                { borrower: { firstName: { contains: filter.search, mode: 'insensitive' } } },
                { borrower: { lastName: { contains: filter.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { borrower: true },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => {
      const ownName = [account.firstName, account.middleName, account.lastName].filter(Boolean).join(' ');
      const borrowerName = account.borrower ? formatFullName(account.borrower) : '';
      return {
        name: borrowerName || ownName || account.email,
        email: account.email,
        contactNumber: account.contactNumber ?? account.mobilePhone1 ?? null,
        status: account.status,
        linkedTo: account.borrower ? borrowerName : null,
        emailVerifiedAt: account.emailVerifiedAt,
        createdAt: account.createdAt,
      };
    });
  }

  async getCicMonthlyReportData(filter: CicMonthlyReportFilter): Promise<CicMonthlyReportData> {
    const monthStart = new Date(Date.UTC(filter.year, filter.month - 1, 1));
    const monthEnd = new Date(Date.UTC(filter.year, filter.month, 0, 23, 59, 59, 999));
    // Plain UTC midnight (no time-of-day component) - `CicCsdfReportWriter.ddmmyyyy` re-bases every
    // date by +8h to read Manila wall-clock fields, so a `referenceDate` carrying `23:59:59.999`
    // would roll over into the next calendar day once shifted. `monthEnd` above is only used for
    // the DB query bound below, never for display.
    const referenceDate = new Date(Date.UTC(filter.year, filter.month, 0));

    // Scope (2026-08-30, user-confirmed fix - found via the user's own real July file showing 30
    // CL contracts where this had 0): this report is generated LATER than the month it covers
    // (e.g. run in August for July), so a loan's CURRENT `status` doesn't tell you whether it was
    // still open AS OF the reporting month's end - a loan closed in August no longer reads ACTIVE
    // today, but it absolutely still belongs in July's file (as 'AC', since it hadn't closed yet
    // as of July 31st). Reconstructed instead from `closedAt` relative to `monthEnd`: still open
    // today (`closedAt: null`), OR closed on/after this month started (was open through at least
    // part of it) - `resolveContractPhase`/`resolveContractEndActualDate` below do the same
    // month-relative recomputation for the actual CI record fields. Excludes loans that never
    // reached a real disbursed contract at all (PENDING_APPROVAL/APPROVED/CLOSED_REJECTED/
    // CLOSED_UNDONE).
    const NEVER_DISBURSED_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'CLOSED_REJECTED', 'CLOSED_UNDONE'] as const;
    const allCandidateLoans = await prisma.loanAccount.findMany({
      where: {
        status: { notIn: [...NEVER_DISBURSED_STATUSES] },
        OR: [{ closedAt: null }, { closedAt: { gte: monthStart } }],
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: { borrower: true, loanProductVersion: { include: { loanProduct: true } } },
      orderBy: { loanCode: 'asc' },
    });

    // 2026-08-30 (user-confirmed, found via ALCINDOR ZUELA's loan "2470"): `activatedAt` can be
    // stale/wrong on old migrated loans - that one reads "2023-01-24" despite its real
    // DISBURSEMENT transaction being dated 2013-01-25 (confirmed against the real 2024 CIC
    // submission data on file: this loan appears in NEITHER the "Loan Accounts" tracker nor any
    // actual submitted CSDF file for that year - it was never in scope, a pre-2019 loan, not a
    // "missing ID" gap). The earliest real DISBURSEMENT transaction is the true contract start
    // when one exists; `activatedAt ?? createdAt` is only a fallback for loans with no disbursement
    // transaction on file at all.
    const candidateLoanIds = allCandidateLoans.map((loan) => loan.id);
    const disbursements =
      candidateLoanIds.length > 0
        ? await prisma.loanTransaction.findMany({
            where: { loanAccountId: { in: candidateLoanIds }, type: 'DISBURSEMENT' },
            select: { loanAccountId: true, entryDate: true },
            orderBy: { entryDate: 'asc' },
          })
        : [];
    const earliestDisbursementByLoanId = new Map<string, Date>();
    for (const d of disbursements) {
      if (!earliestDisbursementByLoanId.has(d.loanAccountId)) earliestDisbursementByLoanId.set(d.loanAccountId, d.entryDate);
    }
    function resolveContractStartDate(loan: (typeof allCandidateLoans)[number]): Date {
      return earliestDisbursementByLoanId.get(loan.id) ?? loan.activatedAt ?? loan.createdAt;
    }
    // A loan only counts as closed FOR THIS REPORTING MONTH if its real closedAt falls on or
    // before this month's end - a loan closed the following month (or later, relative to when this
    // report happens to be generated) was still open as of this period, per resolveContractPhase's
    // own doc comment above.
    function wasClosedAsOf(loan: (typeof allCandidateLoans)[number]): boolean {
      return loan.closedAt !== null && loan.closedAt.getTime() <= monthEnd.getTime();
    }

    // 2026-08-30 (user-confirmed): CIC reporting only started in 2019 - a loan whose contract
    // predates that was never in scope for CIC submission and never will be, regardless of the
    // reporting month.
    // 2026-08-30 (user-confirmed, found via a real July-vs-current count mismatch: this report was
    // over-counting because it only checked the LOWER bound - a loan that started AFTER this
    // reporting month (e.g. an August-originated loan showing up in a July report run today) still
    // has `resolveContractStartDate(loan) >= CIC_REPORTING_START_DATE` trivially true, since that
    // only compares against 2019, not against `monthEnd`). A loan must have actually STARTED by the
    // reporting month's end to belong in that month's file at all.
    const CIC_REPORTING_START_DATE = new Date(Date.UTC(2019, 0, 1));
    const loans = allCandidateLoans.filter((loan) => {
      const start = resolveContractStartDate(loan);
      return start >= CIC_REPORTING_START_DATE && start <= monthEnd;
    });

    const loanIds = loans.map((loan) => loan.id);
    const scheduleRows =
      loanIds.length > 0
        ? await prisma.repaymentSchedule.findMany({ where: { loanAccountId: { in: loanIds } }, orderBy: { installmentNumber: 'asc' } })
        : [];
    const scheduleByLoanId = groupByLoanId(scheduleRows);

    // 2026-08-30 (user-confirmed, major scoping correction): the real monthly submission is NOT a
    // full-portfolio snapshot - only loans that CHANGED that month are included. User-confirmed
    // "changed" means ANY of: had a transaction that month (covers new disbursements, payments,
    // adjustments - a fresh LoanAccount's own DISBURSEMENT transaction lands here too), closed that
    // month, or is currently overdue (days-overdue increases every month a delinquent loan stays
    // unpaid, even with zero payment activity - still a real change CIC needs reported).
    const transactionsThisMonth =
      loanIds.length > 0
        ? await prisma.loanTransaction.findMany({
            where: { loanAccountId: { in: loanIds }, entryDate: { gte: monthStart, lte: monthEnd } },
            select: { loanAccountId: true },
          })
        : [];
    const loanIdsWithTransactionThisMonth = new Set(transactionsThisMonth.map((t) => t.loanAccountId));
    function changedThisMonth(loan: (typeof loans)[number]): boolean {
      if (loanIdsWithTransactionThisMonth.has(loan.id)) return true;
      if (loan.closedAt !== null && loan.closedAt.getTime() >= monthStart.getTime() && loan.closedAt.getTime() <= monthEnd.getTime()) return true;
      const schedule = scheduleByLoanId.get(loan.id) ?? [];
      const isUnpaid = (i: (typeof schedule)[number]) =>
        Number(i.principalPaid) < Number(i.principalDue) || Number(i.interestPaid) < Number(i.interestDue);
      return schedule.some((i) => isUnpaid(i) && i.dueDate.getTime() < referenceDate.getTime());
    }

    const individualsBySubjectNo = new Map<string, CicIndividualRow>();
    const contracts: CicContractRow[] = [];
    const skippedMissingSubjectNo: { loanCode: string; borrowerName: string; reason: 'MISSING_SUBJECT_NO' | 'MISSING_CONTRACT_NO' }[] = [];

    for (const loan of loans) {
      if (!changedThisMonth(loan)) continue;

      const borrower = loan.borrower;
      if (!borrower.cicProviderSubjectNo) {
        skippedMissingSubjectNo.push({ loanCode: loan.loanCode, borrowerName: formatFullName(borrower), reason: 'MISSING_SUBJECT_NO' });
        continue;
      }
      if (!loan.cicProviderContractNo) {
        skippedMissingSubjectNo.push({ loanCode: loan.loanCode, borrowerName: formatFullName(borrower), reason: 'MISSING_CONTRACT_NO' });
        continue;
      }
      const subjectNo = borrower.cicProviderSubjectNo;

      if (!individualsBySubjectNo.has(subjectNo)) {
        // `Borrower.gender` is free text ('MALE'/'FEMALE'/etc, not a fixed enum) - only map the two
        // unambiguous cases, same caution as every other unconfirmed domain code in this report.
        const genderUpper = (borrower.gender ?? '').trim().toUpperCase();
        const genderCode = genderUpper === 'MALE' || genderUpper === 'M' ? 'M' : genderUpper === 'FEMALE' || genderUpper === 'F' ? 'F' : '';
        individualsBySubjectNo.set(subjectNo, {
          providerSubjectNo: subjectNo,
          title: genderCode === 'M' ? '10' : genderCode === 'F' ? '11' : '',
          firstName: borrower.firstName,
          lastName: borrower.lastName,
          middleName: borrower.middleName ?? '',
          suffix: borrower.suffix ?? '',
          gender: genderCode,
          birthDate: borrower.birthDate,
          nationality: borrower.nationality ?? '',
          mobile: borrower.mobilePhone1 ?? borrower.mobilePhone2 ?? '',
          email: borrower.email ?? '',
          employerName: '', // filled below once income detail is fetched
          civilStatusCode: cicCivilStatusCode(borrower.civilStatus),
          tin: '', // filled below once government IDs are fetched
          sss: '',
          idTypeCode: '', // filled below once identification docs are fetched
          idNumber: '',
          occupationStatusCode: '', // filled below once income detail is fetched
          addressFullAddress: '', // filled below once addresses are fetched
          addressStreetNo: '',
          addressPostalCode: '',
          addressBarangay: '',
          addressCity: '',
          addressProvince: '',
        });
      }

      const schedule = scheduleByLoanId.get(loan.id) ?? [];
      const isUnpaid = (i: (typeof schedule)[number]) =>
        Number(i.principalPaid) < Number(i.principalDue) || Number(i.interestPaid) < Number(i.interestDue);
      const outstanding = schedule.filter(isUnpaid);
      const overdue = outstanding.filter((i) => i.dueDate.getTime() < referenceDate.getTime());
      const paidInstallments = schedule.filter((i) => !isUnpaid(i) && (Number(i.principalPaid) > 0 || Number(i.interestPaid) > 0));
      const lastPaid = paidInstallments.length > 0 ? paidInstallments[paidInstallments.length - 1]! : undefined;
      const nextDue = outstanding[0];
      const firstInstallment = schedule[0];
      const earliestOverdue = overdue[0];

      const overdueAmount = overdue.reduce(
        (sum, i) => sum + (Number(i.principalDue) - Number(i.principalPaid)) + (Number(i.interestDue) - Number(i.interestPaid)),
        0,
      );
      const outstandingBalance =
        Number(loan.principalBalance) + Number(loan.interestBalance) + Number(loan.feesBalance) + Number(loan.penaltyBalance);
      const overdueDays = earliestOverdue
        ? Math.max(0, Math.round((referenceDate.getTime() - earliestOverdue.dueDate.getTime()) / 86_400_000))
        : 0;

      const contractTypeCode = cicContractTypeCode(loan.loanProductVersion.loanProduct.code);
      contracts.push({
        providerSubjectNo: subjectNo,
        providerContractNo: loan.cicProviderContractNo,
        loanCode: loan.loanCode,
        contractTypeCode,
        purposeOfCreditCode: contractTypeCode === '12' || contractTypeCode === '20' ? '32' : '',
        contractPhase: wasClosedAsOf(loan) ? 'CL' : 'AC',
        contractStartDate: resolveContractStartDate(loan),
        contractRequestDate: loan.createdAt,
        contractEndPlannedDate: schedule.length > 0 ? schedule[schedule.length - 1]!.dueDate : null,
        contractEndActualDate: wasClosedAsOf(loan) ? loan.closedAt : null,
        financedAmount: loan.principalAmount.toString(),
        installmentsNumber: loan.installmentCount,
        monthlyPaymentAmount: firstInstallment
          ? (Number(firstInstallment.principalDue) + Number(firstInstallment.interestDue)).toFixed(2)
          : '0.00',
        firstPaymentDate: loan.firstRepaymentDate,
        lastPaymentDate: lastPaid?.dueDate ?? null,
        lastPaymentAmount: lastPaid ? (Number(lastPaid.principalPaid) + Number(lastPaid.interestPaid)).toFixed(2) : '0.00',
        nextPaymentDate: nextDue?.dueDate ?? null,
        nextPaymentAmount: nextDue ? (Number(nextDue.principalDue) + Number(nextDue.interestDue)).toFixed(2) : '0.00',
        outstandingPaymentsNumber: outstanding.length,
        outstandingBalance: outstandingBalance.toFixed(2),
        overduePaymentsNumber: overdue.length,
        overduePaymentsAmount: overdueAmount.toFixed(2),
        overdueDays,
      });
    }

    // Employer name + occupation status (BorrowerIncomeDetail) and identification type/number
    // (IdentificationDocument, first on file) - separate 1-to-1/1-to-many tables, not included
    // above to keep the main loan query lean, same reasoning as Address's separate bulk-fetch
    // pattern elsewhere in this file.
    const borrowerIds = [...new Set(loans.map((l) => l.borrowerId))];
    if (borrowerIds.length > 0) {
      const [incomeDetails, identificationDocs, governmentIds, addressRows] = await Promise.all([
        prisma.borrowerIncomeDetail.findMany({ where: { borrowerId: { in: borrowerIds } } }),
        prisma.identificationDocument.findMany({ where: { borrowerId: { in: borrowerIds } } }),
        prisma.borrowerGovernmentId.findMany({ where: { borrowerId: { in: borrowerIds } } }),
        prisma.address.findMany({ where: { ownerType: 'BORROWER', ownerId: { in: borrowerIds } } }),
      ]);
      const incomeByBorrowerId = new Map(incomeDetails.map((d) => [d.borrowerId, d]));
      const governmentIdByBorrowerId = new Map(governmentIds.map((g) => [g.borrowerId, g]));
      const firstIdDocByBorrowerId = new Map<string, (typeof identificationDocs)[number]>();
      for (const doc of identificationDocs) {
        if (!firstIdDocByBorrowerId.has(doc.borrowerId)) firstIdDocByBorrowerId.set(doc.borrowerId, doc);
      }
      const firstAddressByBorrowerId = new Map<string, (typeof addressRows)[number]>();
      for (const address of addressRows) {
        if (!firstAddressByBorrowerId.has(address.ownerId)) firstAddressByBorrowerId.set(address.ownerId, address);
      }
      for (const loan of loans) {
        if (!loan.borrower.cicProviderSubjectNo) continue;
        const row = individualsBySubjectNo.get(loan.borrower.cicProviderSubjectNo);
        if (!row) continue;
        const income = incomeByBorrowerId.get(loan.borrowerId);
        row.employerName = income?.employerName ?? '';
        row.occupationStatusCode = cicOccupationStatusCode(income?.employmentType ?? null);

        const governmentId = governmentIdByBorrowerId.get(loan.borrowerId);
        row.tin = governmentId?.tinNumber ?? '';
        row.sss = governmentId?.sssNumber ?? '';

        const idDoc = firstIdDocByBorrowerId.get(loan.borrowerId);
        if (idDoc) {
          const code = cicIdType(idDoc.documentType);
          row.idTypeCode = code;
          row.idNumber = code ? idDoc.documentNumber : '';
        }

        const address = firstAddressByBorrowerId.get(loan.borrowerId);
        if (address) {
          row.addressFullAddress = formatAddress(address);
          row.addressStreetNo = address.street ?? address.houseUnitNumber ?? '';
          row.addressPostalCode = address.zipCode ?? '';
          row.addressBarangay = address.barangay ?? '';
          row.addressCity = address.cityMunicipality ?? '';
          row.addressProvince = address.province ?? '';
        }
      }
    }

    return {
      referenceDate,
      individuals: [...individualsBySubjectNo.values()],
      contracts,
      skippedMissingSubjectNo,
    };
  }
}

/** Same "first address on file, comma-joined" convention as `LoanDocumentMergeDataResolver.formatAddress` / `ClientProfilePage.tsx`'s `existingAddressLine`. */
function formatAddress(address: { houseUnitNumber?: string | null; street?: string | null; barangay?: string | null; cityMunicipality?: string | null; province?: string | null } | undefined): string {
  if (!address) return '';
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
