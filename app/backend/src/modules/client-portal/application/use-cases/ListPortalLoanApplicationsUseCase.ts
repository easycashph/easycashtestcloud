import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { PortalLoanApplicationSummary } from '../dtos/PortalLoanApplicationDtos';

export interface ListPortalLoanApplicationsUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

/** Backs the portal dashboard's "My Applications" list. */
export class ListPortalLoanApplicationsUseCase {
  constructor(private readonly deps: ListPortalLoanApplicationsUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalLoanApplicationSummary[]> {
    const applications = await this.deps.loanApplicationRepository.findByPortalAccountId(portalAccountId);
    return applications.map((application) => {
      const props = application.toProps();
      return {
        id: props.id,
        branchId: props.branchId,
        status: props.status,
        requestedCategory: props.requestedCategory,
        requestedAmount: props.requestedAmount,
        requestedTermMonths: props.requestedTermMonths,
        createdAt: props.createdAt,
      };
    });
  }
}
