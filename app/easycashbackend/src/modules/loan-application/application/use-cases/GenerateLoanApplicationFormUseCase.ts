import { NotFoundError } from '@shared/errors/DomainError';
import type { AttachmentRecord } from '@modules/document/application/ports/IAttachmentRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import { LoanApplicationFormPdfBuilder, type LoanApplicationFormApprovalDetails } from '../services/LoanApplicationFormPdfBuilder';

export interface GenerateLoanApplicationFormUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  loanAccountRepository: ILoanAccountRepository;
  userRepository: IUserRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
  pdfBuilder?: LoanApplicationFormPdfBuilder;
}

/**
 * 2026-08-21 (user request): prints the original application intake data as a PDF, saved as an
 * Attachment on the application itself so it shows up automatically in the client's Attachments
 * tab (`AttachmentOwnerType.LOAN_APPLICATION`) - no manual upload step. Reuses
 * `UploadAttachmentUseCase` rather than writing to the Attachment table directly, so storage-key
 * generation, activity logging, and validation all stay in one place.
 *
 * Deliberately NOT built on the existing `loan-document` module's docx-template-fill pipeline
 * (`GenerateLoanDocumentUseCase`) - that module authors documents from an admin-uploaded .docx
 * template and only ever reads `LoanAccount` data (post-approval agreements/promissory notes).
 * There's no .docx template to author here (this prints the application form itself, which this
 * codebase has no existing document for), so the PDF is drawn directly with pdf-lib instead - see
 * `LoanApplicationFormPdfBuilder`.
 *
 * `documentCategory` is left `null`: none of `AttachmentDocumentCategory`'s existing values
 * (VALID_ID_*, PROOF_OF_BILLING, etc. — all borrower-supplied document types) describe a
 * system-generated form, and inventing a new one wasn't asked for.
 */
export class GenerateLoanApplicationFormUseCase {
  constructor(private readonly deps: GenerateLoanApplicationFormUseCaseDeps) {}

  async execute(applicationId: string, requestedByUserId: string): Promise<AttachmentRecord> {
    const application = await this.deps.loanApplicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError('LoanApplication', applicationId);
    }

    const props = application.toProps();
    const approval = await this.buildApprovalDetails(application.id, props.reviewedByUserId, props.reviewedAt);

    const builder = this.deps.pdfBuilder ?? new LoanApplicationFormPdfBuilder();
    const pdfBuffer = await builder.build(application, approval);

    const fileName = `Loan-Application-${props.applicantName.replace(/\s+/g, '-')}-${application.id.slice(0, 8)}.pdf`;

    return this.deps.uploadAttachmentUseCase.execute({
      ownerType: 'LOAN_APPLICATION',
      ownerId: application.id,
      fileName,
      fileType: 'application/pdf',
      data: pdfBuffer,
      documentCategory: null,
      uploadedByUserId: requestedByUserId,
    });
  }

  private async buildApprovalDetails(
    applicationId: string,
    reviewedByUserId: string | undefined,
    reviewedAt: Date | undefined,
  ): Promise<LoanApplicationFormApprovalDetails | null> {
    const loanAccount = await this.deps.loanAccountRepository.findBySourceApplicationId(applicationId);
    if (!reviewedByUserId && !loanAccount) return null;

    const reviewer = reviewedByUserId ? await this.deps.userRepository.findById(reviewedByUserId) : null;

    return {
      reviewedByName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}`.trim() : null,
      approvedDate: reviewedAt ?? null,
      loanAccountCode: loanAccount?.loanCode ?? null,
      approvedAmount: loanAccount ? Number(loanAccount.principalAmount.toString()) : null,
      activatedAt: loanAccount?.activatedAt ?? null,
    };
  }
}
