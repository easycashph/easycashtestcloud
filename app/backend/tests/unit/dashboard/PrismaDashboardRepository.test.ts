import { beforeEach, describe, expect, it, vi } from 'vitest';

const loanAccountOps = { aggregate: vi.fn(), groupBy: vi.fn() };
const loanTransactionOps = { aggregate: vi.fn() };
const loanProductVersionOps = { findMany: vi.fn() };
const queryRaw = vi.fn();

const prismaMock = {
  loanAccount: loanAccountOps,
  loanTransaction: loanTransactionOps,
  loanProductVersion: loanProductVersionOps,
  $queryRaw: queryRaw,
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaDashboardRepository } = await import('@modules/dashboard/infrastructure/PrismaDashboardRepository');

function zeroMoneyAggregate(count = 0) {
  return { _count: count, _sum: { principalBalance: 0, interestBalance: 0, feesBalance: 0, penaltyBalance: 0 } };
}

describe('PrismaDashboardRepository (2026-07-12 correctness fix + trend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loanProductVersionOps.findMany.mockResolvedValue([]);
    loanAccountOps.groupBy.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]); // findOverdueLoanAccountIds -> none, by default
  });

  it('Total Active Loans has no trend field (2026-07-12: dropped — 477 of 502 legacy CLOSED loans have no closedAt, making a 30-day reconstruction fabricate a swing)', async () => {
    loanAccountOps.aggregate.mockResolvedValueOnce({ _count: 110, _sum: { principalBalance: 500000 } }).mockResolvedValueOnce(zeroMoneyAggregate(0));
    loanTransactionOps.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } }).mockResolvedValueOnce({ _sum: { amount: 0 } });

    const repo = new PrismaDashboardRepository();
    const summary = await repo.getSummary(undefined);

    expect(summary.totalActiveLoans.count).toBe(110);
    expect(summary.totalActiveLoans).not.toHaveProperty('trend');
  });

  it('returns null changePercent for Collections This Month when the comparison window totaled zero (undefined percent, not Infinity)', async () => {
    loanAccountOps.aggregate.mockResolvedValueOnce({ _count: 5, _sum: { principalBalance: 1000 } }).mockResolvedValueOnce(zeroMoneyAggregate(0));
    loanTransactionOps.aggregate.mockResolvedValueOnce({ _sum: { amount: 500 } }).mockResolvedValueOnce({ _sum: { amount: 0 } });

    const repo = new PrismaDashboardRepository();
    const summary = await repo.getSummary(undefined);

    expect(summary.collectionsThisMonth.trend.changePercent).toBeNull();
  });

  it('computes Collections This Month trend against the SAME elapsed number of days last month, not the full previous month', async () => {
    loanAccountOps.aggregate.mockResolvedValueOnce({ _count: 0, _sum: { principalBalance: 0 } }).mockResolvedValueOnce(zeroMoneyAggregate(0));
    loanTransactionOps.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 150000 } }) // this month to date
      .mockResolvedValueOnce({ _sum: { amount: 100000 } }); // same elapsed window last month

    const repo = new PrismaDashboardRepository();
    const summary = await repo.getSummary(undefined);

    expect(summary.collectionsThisMonth.amount).toBe('150000');
    expect(summary.collectionsThisMonth.trend.changePercent).toBe(50); // (150000-100000)/100000 * 100

    // The comparison window's upper bound must land on today's day-of-month within last month, not startOfMonth(now) (a full-month comparison).
    const lastMonthCallArgs = loanTransactionOps.aggregate.mock.calls[1]![0];
    const upperBound: Date = lastMonthCallArgs.where.entryDate.lt;
    const now = new Date();
    expect(upperBound.getUTCDate()).toBe(now.getUTCDate());
  });

  it('Overdue Accounts count comes from the live installment-based query, not from status="ACTIVE_IN_ARREARS" alone', async () => {
    loanAccountOps.aggregate
      .mockResolvedValueOnce({ _count: 0, _sum: { principalBalance: 0 } })
      .mockResolvedValueOnce({ _count: 3, _sum: { principalBalance: 30000, interestBalance: 3000, feesBalance: 0, penaltyBalance: 500 } });
    queryRaw.mockResolvedValueOnce([{ id: 'loan-1' }, { id: 'loan-2' }, { id: 'loan-3' }]);
    loanTransactionOps.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } }).mockResolvedValueOnce({ _sum: { amount: 0 } });

    const repo = new PrismaDashboardRepository();
    const summary = await repo.getSummary(undefined);

    expect(summary.overdueAccounts.count).toBe(3);
    expect(summary.overdueAccounts.atRiskCollectionsBalance).toBe('33500');
    // The aggregate call for overdue balances must be scoped to exactly the ids the live query found.
    expect(loanAccountOps.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['loan-1', 'loan-2', 'loan-3'] } } }),
    );
  });
});
