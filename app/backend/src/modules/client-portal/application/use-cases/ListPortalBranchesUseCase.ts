import type { IBranchRepository } from '@modules/loan-application/application/ports/IBranchRepository';
import type { PortalBranchSummary } from '../dtos/PortalLoanApplicationDtos';

export interface ListPortalBranchesUseCaseDeps {
  branchRepository: IBranchRepository;
}

/** Backs the portal loan application form's branch picker. */
export class ListPortalBranchesUseCase {
  constructor(private readonly deps: ListPortalBranchesUseCaseDeps) {}

  async execute(): Promise<PortalBranchSummary[]> {
    return this.deps.branchRepository.findAllActive();
  }
}
