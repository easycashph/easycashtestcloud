import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import { getRequiredDocumentCategories } from '@modules/loan-application/application/config/requiredDocumentCategories';
import type { PortalLoanApplicationSummary } from '../dtos/PortalLoanApplicationDtos';

export interface ListPortalLoanApplicationsUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  attachmentRepository: IAttachmentRepository;
}

/** Backs the portal dashboard's "My Applications" list. */
export class ListPortalLoanApplicationsUseCase {
  constructor(private readonly deps: ListPortalLoanApplicationsUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalLoanApplicationSummary[]> {
    const applications = await this.deps.loanApplicationRepository.findByPortalAccountId(portalAccountId);
    return Promise.all(
      applications.map(async (application) => {
        const props = application.toProps();
        const attachments = await this.deps.attachmentRepository.listByOwner('LOAN_APPLICATION', props.id);
        const uploadedCategories = new Set(attachments.map((a) => a.documentCategory));
        const required = getRequiredDocumentCategories(props.requestedCategory, Boolean(props.coBorrowerName));
        const missingCount = required.filter((category) => !uploadedCategories.has(category)).length;
        // 2026-07-31 (user request): "Other" is also where an applicant re-uploads a corrected
        // replacement for a document they got wrong the first time, or a supporting document that
        // doesn't fit any specific slot - each Other upload can stand in for one still-missing
        // required category, rather than only exact-category matches counting.
        const otherUploadsCount = attachments.filter((a) => a.documentCategory === 'OTHER_SUPPORTING_DOCUMENT').length;
        return {
          id: props.id,
          branchId: props.branchId,
          status: props.status,
          requestedCategory: props.requestedCategory,
          requestedAmount: props.requestedAmount,
          requestedTermMonths: props.requestedTermMonths,
          createdAt: props.createdAt,
          documentsComplete: missingCount <= otherUploadsCount,
        };
      }),
    );
  }
}
