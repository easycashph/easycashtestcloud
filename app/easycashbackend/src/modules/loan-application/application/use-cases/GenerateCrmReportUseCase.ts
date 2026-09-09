import { NotFoundError } from '@shared/errors/DomainError';
import type { AttachmentRecord } from '@modules/document/application/ports/IAttachmentRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import { CrmReportPdfBuilder } from '../services/CrmReportPdfBuilder';

export interface GenerateCrmReportUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
  pdfBuilder?: CrmReportPdfBuilder;
}

/**
 * 2026-09-09 (user request): "CRM Report" - a downloadable/printable PDF of the Underwriting card's
 * Credit Evaluation Report data (CI/credit bureau checks, document checklist, mitigation, agency
 * verification, conditions/recommendation), which previously only existed as on-screen form
 * fields. Mirrors GenerateLoanApplicationFormUseCase exactly: saved as an Attachment on the
 * application itself (auto-shows in the Attachments tab, no manual upload step), same
 * `documentCategory: null` reasoning (a system-generated report, not a borrower-supplied document
 * type). The frontend previews it in a new tab before it's "saved" anywhere further, same UX as
 * Print Application.
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
