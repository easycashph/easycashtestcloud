import { prisma } from '@shared/database/prismaClient';
import type {
  CollectionReportRow,
  DateRangeFilter,
  IReportingRepository,
  ListReportTransactionsOptions,
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
    const rows = await prisma.loanTransaction.findMany({
      where: {
        ...(options.type ? { type: options.type as never } : {}),
        ...(options.branchId ? { branchId: options.branchId } : {}),
        entryDate: entryDateFilter(options),
      },
      orderBy: { entryDate: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: {
        loanAccount: { select: { loanCode: true, borrower: { select: { firstName: true, lastName: true } } } },
        branch: { select: { name: true } },
      },
    });

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
}
