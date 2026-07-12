import { prisma } from '@shared/database/prismaClient';
import type { DashboardSummary, IDashboardRepository } from '../application/ports/IDashboardRepository';

const ACTIVE_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;

/**
 * Milestone 9.2: every aggregate below is computed on demand straight from `loan_accounts`/
 * `loan_transactions` — no summary table, no caching. Acceptable at today's volume (thousands of
 * loans, not the 100,000+ CLAUDE.md's performance goals target); revisit with a materialized
 * summary or scheduled rollup if this page's query cost becomes a problem at that scale.
 */
export class PrismaDashboardRepository implements IDashboardRepository {
  async getSummary(branchId: string | undefined): Promise<DashboardSummary> {
    const branchFilter = branchId ? { branchId } : {};

    const forecastMonths = nextFourMonthRanges();

    const [activeAgg, overdueAgg, collectionsAgg, byProductGroups, forecastAggs] = await Promise.all([
      prisma.loanAccount.aggregate({
        where: { ...branchFilter, status: { in: [...ACTIVE_STATUSES] } },
        _count: true,
        _sum: { principalBalance: true },
      }),
      prisma.loanAccount.aggregate({
        where: { ...branchFilter, status: 'ACTIVE_IN_ARREARS' },
        _count: true,
        _sum: { principalBalance: true, interestBalance: true, feesBalance: true, penaltyBalance: true },
      }),
      prisma.loanTransaction.aggregate({
        where: {
          ...branchFilter,
          type: 'REPAYMENT',
          entryDate: { gte: startOfCurrentMonth(), lt: startOfNextMonth() },
        },
        _sum: { amount: true },
      }),
      prisma.loanAccount.groupBy({
        by: ['loanProductVersionId'],
        where: { ...branchFilter, status: { in: [...ACTIVE_STATUSES] } },
        _count: true,
        _sum: { principalBalance: true },
      }),
      Promise.all(
        forecastMonths.map((range) =>
          prisma.repaymentSchedule.aggregate({
            where: {
              dueDate: { gte: range.start, lt: range.end },
              loanAccount: { status: { in: [...ACTIVE_STATUSES] }, ...branchFilter },
            },
            _sum: { principalDue: true, interestDue: true },
          }),
        ),
      ),
    ]);

    const versionIds = byProductGroups.map((g) => g.loanProductVersionId);
    const versions = await prisma.loanProductVersion.findMany({
      where: { id: { in: versionIds } },
      select: { id: true, loanProductId: true, loanProduct: { select: { id: true, name: true } } },
    });
    const versionToProduct = new Map(versions.map((v) => [v.id, v.loanProduct]));

    const byProductId = new Map<string, { productId: string; productName: string; count: number; outstandingPrincipalBalance: number }>();
    for (const group of byProductGroups) {
      const product = versionToProduct.get(group.loanProductVersionId);
      if (!product) continue; // Orphaned version reference — shouldn't happen, skip defensively rather than crash the dashboard.
      const existing = byProductId.get(product.id) ?? {
        productId: product.id,
        productName: product.name,
        count: 0,
        outstandingPrincipalBalance: 0,
      };
      existing.count += group._count;
      existing.outstandingPrincipalBalance += Number(group._sum.principalBalance ?? 0);
      byProductId.set(product.id, existing);
    }

    const overdueCollectionsBalance =
      Number(overdueAgg._sum.principalBalance ?? 0) +
      Number(overdueAgg._sum.interestBalance ?? 0) +
      Number(overdueAgg._sum.feesBalance ?? 0) +
      Number(overdueAgg._sum.penaltyBalance ?? 0);

    return {
      totalActiveLoans: {
        count: activeAgg._count,
        outstandingPrincipalBalance: (activeAgg._sum.principalBalance ?? 0).toString(),
      },
      overdueAccounts: {
        count: overdueAgg._count,
        atRiskCollectionsBalance: overdueCollectionsBalance.toString(),
      },
      collectionsThisMonth: {
        amount: (collectionsAgg._sum.amount ?? 0).toString(),
      },
      portfolioByProduct: [...byProductId.values()].map((p) => ({
        ...p,
        outstandingPrincipalBalance: p.outstandingPrincipalBalance.toString(),
      })),
      collectionsForecast: forecastMonths.map((range, i) => {
        const agg = forecastAggs[i];
        return {
          month: MONTH_ABBREVIATIONS[range.start.getUTCMonth()] as string,
          year: range.start.getUTCFullYear(),
          scheduledAmount: (Number(agg?._sum.principalDue ?? 0) + Number(agg?._sum.interestDue ?? 0)).toString(),
        };
      }),
    };
  }
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** The 4 calendar months following the current one - matches the Dashboard's "Collections
 * Forecast" card ("Next 4 months"), which starts the count at next month, not the current one. */
function nextFourMonthRanges(): { start: Date; end: Date }[] {
  const now = new Date();
  const ranges: { start: Date; end: Date }[] = [];
  for (let i = 1; i <= 4; i++) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 1));
    ranges.push({ start, end });
  }
  return ranges;
}
