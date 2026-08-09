import { NotFoundError } from '@shared/errors/DomainError';
import { DocumentTemplateIsRequiredError } from '../../domain/errors/LoanDocumentDomainErrors';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface SetDocumentTemplateProductMappingsUseCaseDeps {
  documentTemplateRepository: IDocumentTemplateRepository;
}

/**
 * 2026-08-09 (Document Templates admin config, user request): wholesale-replaces which Loan
 * Products a Conditional template applies to. Refuses on a currently-Required template - see
 * `DocumentTemplateIsRequiredError`'s own doc comment.
 */
export class SetDocumentTemplateProductMappingsUseCase {
  constructor(private readonly deps: SetDocumentTemplateProductMappingsUseCaseDeps) {}

  async execute(documentTemplateId: string, loanProductIds: string[]): Promise<void> {
    const template = await this.deps.documentTemplateRepository.findById(documentTemplateId);
    if (!template) throw new NotFoundError('DocumentTemplate', documentTemplateId);
    if (template.isRequired) throw new DocumentTemplateIsRequiredError(template.code);

    await this.deps.documentTemplateRepository.setProductMappings(documentTemplateId, loanProductIds);
  }
}
