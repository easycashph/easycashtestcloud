import type { DashboardSummary, IDashboardRepository } from '../ports/IDashboardRepository';

export interface GetDashboardSummaryUseCaseDeps {
  dashboardRepository: IDashboardRepository;
}

export class GetDashboardSummaryUseCase {
  constructor(private readonly deps: GetDashboardSummaryUseCaseDeps) {}

  async execute(branchId: string | undefined): Promise<DashboardSummary> {
    return this.deps.dashboardRepository.getSummary(branchId);
  }
}
