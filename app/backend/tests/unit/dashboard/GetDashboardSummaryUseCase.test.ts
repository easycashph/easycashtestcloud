import { describe, expect, it, vi } from 'vitest';
import { GetDashboardSummaryUseCase } from '@modules/dashboard/application/use-cases/GetDashboardSummaryUseCase';
import type { DashboardSummary } from '@modules/dashboard/application/ports/IDashboardRepository';

const emptySummary: DashboardSummary = {
  totalActiveLoans: { count: 0, outstandingPrincipalBalance: '0' },
  overdueAccounts: { count: 0, atRiskCollectionsBalance: '0', loanAccountIds: [], maturedLoanAccountIds: [] },
  collectionsThisMonth: { amount: '0', trend: { changePercent: null } },
  portfolioByProduct: [],
};

describe('GetDashboardSummaryUseCase', () => {
  it('delegates to the repository with the given branchId', async () => {
    const dashboardRepository = { getSummary: vi.fn().mockResolvedValue(emptySummary) };
    const useCase = new GetDashboardSummaryUseCase({ dashboardRepository });

    const result = await useCase.execute('branch-1');

    expect(dashboardRepository.getSummary).toHaveBeenCalledWith('branch-1');
    expect(result).toBe(emptySummary);
  });

  it('passes undefined through unchanged for a global (MIS) caller', async () => {
    const dashboardRepository = { getSummary: vi.fn().mockResolvedValue(emptySummary) };
    const useCase = new GetDashboardSummaryUseCase({ dashboardRepository });

    await useCase.execute(undefined);

    expect(dashboardRepository.getSummary).toHaveBeenCalledWith(undefined);
  });
});
