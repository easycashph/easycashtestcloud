import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { DocumentTemplate } from '../../domain/DocumentTemplate';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface UpdateDocumentTemplateRequiredUseCaseDeps {
  documentTemplateRepository: IDocumentTemplateRepository;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-08-09 (Document Templates admin config, user request): toggles a template between
 * Required and Conditional. Flipping Conditional -> Required also clears that template's
 * `DocumentTemplateMapping` rows in the same transaction - a Required template applies to every
 * loan, so a stale per-product mapping would be misleading (matches the schema's own "required
 * documents ... have no DocumentTemplateMapping row" invariant). Flipping Required -> Conditional
 * leaves mappings empty (nothing to clear) - MIS then uses the product-mapping screen to pick
 * which products it applies to.
 */
export class UpdateDocumentTemplateRequiredUseCase {
  constructor(private readonly deps: UpdateDocumentTemplateRequiredUseCaseDeps) {}

  async execute(documentTemplateId: string, isRequired: boolean): Promise<DocumentTemplate> {
    const template = await this.deps.documentTemplateRepository.findById(documentTemplateId);
    if (!template) throw new NotFoundError('DocumentTemplate', documentTemplateId);

    template.setRequired(isRequired);

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.documentTemplateRepository.update(template, ctx);
      if (isRequired) {
        await this.deps.documentTemplateRepository.setProductMappings(documentTemplateId, [], ctx);
      }
    });

    return template;
  }
}
