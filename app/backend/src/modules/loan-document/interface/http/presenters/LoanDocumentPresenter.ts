import type { GeneratedLoanDocument } from '../../../domain/GeneratedLoanDocument';
import type { LoanDocumentListItem } from '../../../application/use-cases/ListLoanDocumentsUseCase';

/** For the generate endpoint's response — no template/author names available here (no join on a fresh write); the frontend already has the list from GET and its own current user's name. */
export function presentGeneratedLoanDocument(document: GeneratedLoanDocument) {
  return {
    id: document.id,
    loanAccountId: document.loanAccountId,
    documentTemplateId: document.documentTemplateId,
    generatedByUserId: document.generatedByUserId,
    generatedAt: document.generatedAt.toISOString(),
  };
}

export function presentLoanDocumentListItem(item: LoanDocumentListItem) {
  return {
    documentTemplateId: item.documentTemplateId,
    documentTemplateCode: item.documentTemplateCode,
    documentTemplateName: item.documentTemplateName,
    isRequired: item.isRequired,
    latestGeneration: item.latestGeneration
      ? {
          id: item.latestGeneration.id,
          generatedByUserId: item.latestGeneration.generatedByUserId,
          generatedByName: item.latestGeneration.generatedByName,
          generatedAt: item.latestGeneration.generatedAt.toISOString(),
        }
      : null,
  };
}
