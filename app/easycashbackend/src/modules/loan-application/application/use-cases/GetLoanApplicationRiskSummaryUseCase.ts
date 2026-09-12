import type { ILoanApplicationRepository, RiskTierCounts } from '../ports/ILoanApplicationRepository';

export interface GetLoanApplicationRiskSummaryUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

/** Backs the Loan Applications list's risk-summary tiles (2026-09-12 user request) - counts by
 * Low/Medium/High DTI risk tier, scoped by branch only so it reads as a stable snapshot rather
 * than shifting with the list's own search/category/date filters. */
export class GetLoanApplicationRiskSummaryUseCase {
  constructor(private readonly deps: GetLoanApplicationRiskSummaryUseCaseDeps) {}

  async execute(branchId: string | undefined): Promise<RiskTierCounts> {
    return this.deps.loanApplicationRepository.countByRiskTier(branchId);
  }
}
