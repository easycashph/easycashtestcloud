import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface ListPortalLoanApplicationDocumentsUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  attachmentRepository: IAttachmentRepository;
}

/** Portal avatar upload (2026-07-27 user request) - same ownership check as
 * UploadPortalLoanApplicationDocumentUseCase (portalAccountId on the application, not borrowerId). */
export class ListPortalLoanApplicationDocumentsUseCase {
  constructor(private readonly deps: ListPortalLoanApplicationDocumentsUseCaseDeps) {}

  async execute(portalAccountId: string, loanApplicationId: string): Promise<AttachmentRecord[]> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }

    return this.deps.attachmentRepository.listByOwner('LOAN_APPLICATION', loanApplicationId);
  }
}
