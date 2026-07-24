import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import type {
  UpdateLoanApplicationSelfServiceInput,
  UpdateLoanApplicationSelfServiceUseCase,
} from '@modules/loan-application/application/use-cases/UpdateLoanApplicationSelfServiceUseCase';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface UpdatePortalLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  updateLoanApplicationSelfServiceUseCase: UpdateLoanApplicationSelfServiceUseCase;
}

/** A client may only edit a LoanApplication they themselves submitted, and only while it's still
 * PREAPPROVED/PREDECLINED (enforced by the wrapped use case's own domain guard) - same ownership
 * check as UploadPortalLoanApplicationDocumentUseCase. */
export class UpdatePortalLoanApplicationUseCase {
  constructor(private readonly deps: UpdatePortalLoanApplicationUseCaseDeps) {}

  async execute(portalAccountId: string, loanApplicationId: string, patch: UpdateLoanApplicationSelfServiceInput): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }
    return this.deps.updateLoanApplicationSelfServiceUseCase.execute(loanApplicationId, patch);
  }
}
