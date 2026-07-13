import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';
import type { IGeneratedLoanDocumentRepository, GeneratedLoanDocumentView } from '../ports/IGeneratedLoanDocumentRepository';

export interface LoanDocumentListItem {
  documentTemplateId: string;
  documentTemplateCode: string;
  documentTemplateName: string;
  isRequired: boolean;
  latestGeneration: GeneratedLoanDocumentView | null;
}

export interface ListLoanDocumentsUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
}

/** ADR-051 §5: the full list backing the Documents tab — every applicable template (required + conditional-for-this-product), each paired with its latest generation if one exists. */
export class ListLoanDocumentsUseCase {
  constructor(private readonly deps: ListLoanDocumentsUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanDocumentListItem[]> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
    if (!loanProductVersion) throw new NotFoundError('LoanProductVersion', loanAccount.loanProductVersionId);

    const [required, conditional, generated] = await Promise.all([
      this.deps.documentTemplateRepository.findRequired(),
      this.deps.documentTemplateRepository.findConditionalForLoanProduct(loanProductVersion.loanProductId),
      this.deps.generatedLoanDocumentRepository.findLatestPerTemplateForLoanAccount(loanAccountId),
    ]);

    const latestByTemplateId = new Map(generated.map((g) => [g.documentTemplateId, g]));
    const allTemplates = [...required, ...conditional].sort((a, b) => a.sortIndex - b.sortIndex);

    return allTemplates.map((template) => ({
      documentTemplateId: template.id,
      documentTemplateCode: template.code,
      documentTemplateName: template.name,
      isRequired: template.isRequired,
      latestGeneration: latestByTemplateId.get(template.id) ?? null,
    }));
  }
}
