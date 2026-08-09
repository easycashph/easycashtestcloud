import { NotFoundError } from '@shared/errors/DomainError';
import type { DocumentTemplate } from '../../domain/DocumentTemplate';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface UpdateDocumentTemplateSignatureRequirementsUseCaseDeps {
  documentTemplateRepository: IDocumentTemplateRepository;
}

/**
 * 2026-08-09 (Document Templates admin config, user request): sets which party(ies) must sign a
 * template once generated. Independent of Required/Conditional and product mapping - those
 * decide whether the document is generated at all; this decides which e-signature batch(es)
 * (`CreateLoanSigningSessionUseCase`'s `partyType` filter) it's included in once it is. A single
 * field write, no side effects on other data - no transaction needed.
 */
export class UpdateDocumentTemplateSignatureRequirementsUseCase {
  constructor(private readonly deps: UpdateDocumentTemplateSignatureRequirementsUseCaseDeps) {}

  async execute(
    documentTemplateId: string,
    requiresBorrowerSignature: boolean,
    requiresCoBorrowerSignature: boolean,
  ): Promise<DocumentTemplate> {
    const template = await this.deps.documentTemplateRepository.findById(documentTemplateId);
    if (!template) throw new NotFoundError('DocumentTemplate', documentTemplateId);

    template.setSignatureRequirements(requiresBorrowerSignature, requiresCoBorrowerSignature);
    await this.deps.documentTemplateRepository.update(template);

    return template;
  }
}
