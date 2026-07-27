import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@modules/document/application/ports/IFileStorage';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface DownloadPortalLoanApplicationDocumentUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
}

/** Portal avatar upload (2026-07-27 user request) - a client may only download an attachment that
 * belongs to a LoanApplication they themselves submitted (same ownership check as
 * ListPortalLoanApplicationDocumentsUseCase/UploadPortalLoanApplicationDocumentUseCase). Same
 * unified "not found" error whether the attachment truly doesn't exist or belongs to someone
 * else's application - never lets a caller probe for other clients' documents. */
export class DownloadPortalLoanApplicationDocumentUseCase {
  constructor(private readonly deps: DownloadPortalLoanApplicationDocumentUseCaseDeps) {}

  async execute(portalAccountId: string, loanApplicationId: string, documentId: string): Promise<{ record: AttachmentRecord; data: Buffer }> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }

    const record = await this.deps.attachmentRepository.findById(documentId);
    if (!record || record.ownerType !== 'LOAN_APPLICATION' || record.ownerId !== loanApplicationId) {
      throw new PortalLoanApplicationNotFoundError();
    }

    const data = await this.deps.fileStorage.read(record.storageKey);
    return { record, data };
  }
}
