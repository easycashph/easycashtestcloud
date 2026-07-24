import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface GetPortalLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

/** Backs the portal's "edit my application" form - needs the FULL record (not the dashboard
 * list's summary shape) to prefill every field. Same ownership check as the other portal
 * loan-application use cases. */
export class GetPortalLoanApplicationUseCase {
  constructor(private readonly deps: GetPortalLoanApplicationUseCaseDeps) {}

  async execute(portalAccountId: string, loanApplicationId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }
    return application;
  }
}
