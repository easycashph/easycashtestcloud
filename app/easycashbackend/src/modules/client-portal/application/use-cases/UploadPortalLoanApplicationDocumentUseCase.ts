import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { AttachmentDocumentCategory, AttachmentRecord } from '@modules/document/application/ports/IAttachmentRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface UploadPortalLoanApplicationDocumentInput {
  portalAccountId: string;
  loanApplicationId: string;
  fileName: string;
  fileType: string;
  data: Buffer;
  documentCategory: AttachmentDocumentCategory | null;
}

export interface UploadPortalLoanApplicationDocumentUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
}

/** A client may only attach documents to a LoanApplication they themselves submitted -
 * `portalAccountId` on the application is the ownership check (not `borrowerId`, which may be
 * shared across a client's whole application history and isn't set until staff links one). */
export class UploadPortalLoanApplicationDocumentUseCase {
  constructor(private readonly deps: UploadPortalLoanApplicationDocumentUseCaseDeps) {}

  async execute(input: UploadPortalLoanApplicationDocumentInput): Promise<AttachmentRecord> {
    const application = await this.deps.loanApplicationRepository.findById(input.loanApplicationId);
    if (!application || application.portalAccountId !== input.portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }

    return this.deps.uploadAttachmentUseCase.execute({
      ownerType: 'LOAN_APPLICATION',
      ownerId: input.loanApplicationId,
      fileName: input.fileName,
      fileType: input.fileType,
      data: input.data,
      documentCategory: input.documentCategory,
      uploadedByUserId: null,
    });
  }
}
