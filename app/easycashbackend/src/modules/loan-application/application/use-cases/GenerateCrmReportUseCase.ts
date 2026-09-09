import { NotFoundError } from '@shared/errors/DomainError';
import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@modules/document/application/ports/IFileStorage';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import { CrmReportPdfBuilder } from '../services/CrmReportPdfBuilder';

export interface GenerateCrmReportUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
  pdfBuilder?: CrmReportPdfBuilder;
}

/**
 * 2026-09-09 (user request): "CRM Report" - a downloadable/printable PDF of the Underwriting card's
 * Credit Evaluation Report data (CI/credit bureau checks, document checklist, mitigation, agency
 * verification, conditions/recommendation), which previously only existed as on-screen form
 * fields. Mirrors GenerateLoanApplicationFormUseCase exactly: saved as an Attachment on the
 * application itself (auto-shows in the Attachments tab, no manual upload step), same
 * `documentCategory: null` reasoning (a system-generated report, not a borrower-supplied document
 * type). The frontend previews/downloads it via the same generate step.
 *
 * 2026-09-09 (user follow-up, "isang beses lang mag-attach"): every Preview/Download click re-runs
 * this use case, and each run used to create a brand-new Attachment - clicking Preview a few times
 * while reviewing a draft piled up several near-identical "CRM Report" files in the Attachments
 * tab. Now replaces in place: any existing attachment(s) on this application whose fileName exactly
 * matches this run's own naming convention are deleted (DB row + underlying file) before the fresh
 * one is uploaded. Exact-fileName match, not a prefix/substring search, so this can never touch an
 * unrelated attachment that merely happens to start with "CRM-Report-".
 */
export class GenerateCrmReportUseCase {
  constructor(private readonly deps: GenerateCrmReportUseCaseDeps) {}

  async execute(applicationId: string, requestedByUserId: string): Promise<AttachmentRecord> {
    const application = await this.deps.loanApplicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError('LoanApplication', applicationId);
    }

    const builder = this.deps.pdfBuilder ?? new CrmReportPdfBuilder();
    const pdfBuffer = await builder.build(application);

    const props = application.toProps();
    const fileName = `CRM-Report-${props.applicantName.replace(/\s+/g, '-')}-${application.id.slice(0, 8)}.pdf`;

    const existing = await this.deps.attachmentRepository.listByOwner('LOAN_APPLICATION', application.id);
    for (const attachment of existing) {
      if (attachment.fileName !== fileName) continue;
      await this.deps.fileStorage.delete(attachment.storageKey);
      await this.deps.attachmentRepository.delete(attachment.id);
    }

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
}
