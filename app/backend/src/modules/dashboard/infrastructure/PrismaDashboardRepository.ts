import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { DashboardSummary, IDashboardRepository } from '../application/ports/IDashboardRepository';

const ACTIVE_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;

/**
 * Milestone 9.2: every aggregate below is computed on demand straight from `loan_accounts`/
 * `loan_transactions`/`repayment_schedules` — no summary table, no caching. Acceptable at today's
 * volume (thousands of loans, not the 100,000+ CLAUDE.md's performance goals target); revisit with
 * a materialized summary or scheduled rollup if this page's query cost becomes a problem at that
 * scale.
 */
export class PrismaDashboardRepository implements IDashboardRepository {
  async getSummary(branchId: string | undefined): Promise<DashboardSummary> {
    const branchFilter = branchId ? { branchId } : {};
    const now = new Date();
    const forecastMonths = nextFourMonthRanges();

    const [
      activeAgg,
      overdueLoans,
      collectionsAgg,
      collectionsSameWindowLastMonthAgg,
      byProductGroups,
      forecastAggs,
      applicationStatusGroups,
      releasedCount,
    ] = await Promise.all([
      prisma.loanAccount.aggregate({
        where: { ...branchFilter, status: { in: [...ACTIVE_STATUSES] } },
        _count: true,
        _sum: { principalBalance: true },
      }),
      findOverdueLoanAccounts(now, branchId),
      prisma.loanTransaction.aggregate({
        where: { ...branchFilter, type: 'REPAYMENT', entryDate: { gte: startOfMonth(now), lt: startOfNextMonth(now) } },
        _sum: { amount: true },
      }),
      prisma.loanTransaction.aggregate({
        where: {
          ...branchFilter,
          type: 'REPAYMENT',
          entryDate: { gte: startOfLastMonth(now), lt: sameElapsedPointLastMonth(now) },
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
      prisma.loanApplication.groupBy({ by: ['status'], where: branchFilter, _count: true }),
      prisma.loanApplication.count({
        where: {
          ...branchFilter,
          status: 'APPROVED',
          createdLoanAccount: { status: { notIn: ['PENDING_APPROVAL', 'APPROVED'] } },
        },
      }),
    ]);

    const overdueAgg = await prisma.loanAccount.aggregate({
      where: { id: { in: overdueLoans.overdueIds } },
      _count: true,
      _sum: { principalBalance: true, interestBalance: true, feesBalance: true, penaltyBalance: true },
    });

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

    const applicationCountByStatus = new Map(applicationStatusGroups.map((g) => [g.status, g._count]));
    const rawApprovedCount = applicationCountByStatus.get('APPROVED') ?? 0;
    const loanApplicationPipeline = {
      requirementCompliance: applicationCountByStatus.get('PREAPPROVED') ?? 0,
      underwriting: applicationCountByStatus.get('UNDER_REVIEW') ?? 0,
      review: applicationCountByStatus.get('PRE_APPROVAL') ?? 0,
      // Sequential, non-overlapping with `released` (pulled out of the raw APPROVED count) so the
      // funnel's taper reads correctly - see this field's own doc comment on IDashboardRepository.
      approved: Math.max(0, rawApprovedCount - releasedCount),
      released: releasedCount,
      declined: (applicationCountByStatus.get('DECLINED') ?? 0) + (applicationCountByStatus.get('PREDECLINED') ?? 0),
    };

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
        loanAccountIds: overdueLoans.overdueIds,
        maturedLoanAccountIds: overdueLoans.maturedIds,
      },
      collectionsThisMonth: {
        amount: (collectionsAgg._sum.amount ?? 0).toString(),
        trend: {
          changePercent: changePercent(Number(collectionsAgg._sum.amount ?? 0), Number(collectionsSameWindowLastMonthAgg._sum.amount ?? 0)),
        },
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
      loanApplicationPipeline,
    };
  }
}

/**
 * 2026-07-12 (dashboard correctness fix): the OLD query filtered on `LoanAccount.status =
 * 'ACTIVE_IN_ARREARS'`, but nothing in this codebase ever transitions a loan into that status —
 * it only ever arrives pre-set from the legacy migration, so this undercounted (silently showed 0
 * new overdue accounts) for every loan created through this system. Computes live instead, the
 * same way `payment-reminder`'s `PrismaPaymentReminderRepository` already does: a loan is overdue
 * if it has at least one `RepaymentSchedule` row past due with less paid than owed, matching
 * `RepaymentInstallment.status`'s own `LATE` definition exactly (`domain/RepaymentInstallment.ts`).
 *
 * Also splits out "matured" — the subset of overdue loans whose LAST installment (`MAX(dueDate)`,
 * i.e. the loan's own maturity date) has already passed, meaning the whole scheduled term is over
 * and it's still unpaid. Previously untracked entirely (`DashboardPage.tsx`'s Loan Portfolio
 * Health Venn diagram's "Matured" segment always read 0 — nothing computed this concept at all).
 */
async function findOverdueLoanAccounts(asOf: Date, branchId: string | undefined): Promise<{ overdueIds: string[]; maturedIds: string[] }> {
  const branchClause = branchId ? Prisma.sql`AND la."branchId" = ${branchId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string; isMatured: boolean }[]>(Prisma.sql`
    WITH overdue AS (
      SELECT DISTINCT rs."loanAccountId" AS id
      FROM repayment_schedules rs
      JOIN loan_accounts la ON la.id = rs."loanAccountId"
      WHERE rs."dueDate" < ${asOf}
        AND (rs."principalPaid" + rs."interestPaid" + rs."feesPaid" + rs."penaltyPaid")
            < (rs."principalDue" + rs."interestDue" + rs."feesDue" + rs."penaltyDue")
        AND la.status IN ('ACTIVE', 'ACTIVE_IN_ARREARS')
        ${branchClause}
    ),
    maturity AS (
      SELECT "loanAccountId" AS id, MAX("dueDate") AS maturity_date
      FROM repayment_schedules
      GROUP BY "loanAccountId"
    )
    SELECT overdue.id, (maturity.maturity_date < ${asOf}) AS "isMatured"
    FROM overdue
    JOIN maturity ON maturity.id = overdue.id
  `);
  return {
    overdueIds: rows.map((r) => r.id),
    maturedIds: rows.filter((r) => r.isMatured).map((r) => r.id),
  };
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `null` when `previous` is 0 — a percentage change from zero is undefined, not infinite. */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function startOfMonth(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
}

function startOfNextMonth(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
}

function startOfLastMonth(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1));
}

/**
 * 2026-07-12: the exclusive upper bound for last month's comparison window — the same number of
 * days into last month as `reference` is into the current month (e.g. reference = Jul 12 ->
 * Jun 13, giving a Jun 1-12 window to match Jul 1-12 to date). Comparing a partial current month
 * against a *completed* last month made the trend swing wildly negative for most of any given
 * month; this keeps both windows the same length.
 */
function sameElapsedPointLastMonth(reference: Date): Date {
  const last = startOfLastMonth(reference);
  return new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), reference.getUTCDate()));
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
