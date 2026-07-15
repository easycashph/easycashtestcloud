import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type {
  CollectionReportRow,
  DateRangeFilter,
  IReportingRepository,
  ListReportTransactionsOptions,
  LoanReleaseReportRow,
  OriginationReportRow,
  ReportGranularity,
  TransactionReportRow,
} from '../application/ports/IReportingRepository';

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
}

/** Same "first address on file, comma-joined" convention as `LoanDocumentMergeDataResolver.formatAddress` / `ClientProfilePage.tsx`'s `existingAddressLine`. */
function formatAddress(address: { houseUnitNumber?: string | null; street?: string | null; barangay?: string | null; cityMunicipality?: string | null; province?: string | null } | undefined): string {
  if (!address) return '';
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
