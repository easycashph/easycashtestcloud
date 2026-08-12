import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { DocumentTemplate } from '../../domain/DocumentTemplate';
import type { DocumentTemplateProductMapping, IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface ListDocumentTemplatesForAdminUseCaseDeps {
  documentTemplateRepository: IDocumentTemplateRepository;
  loanProductRepository: ILoanProductRepository;
}

export interface DocumentTemplateAdminResult {
  templates: DocumentTemplate[];
  loanProducts: { id: string; code: string; name: string }[];
  mappings: DocumentTemplateProductMapping[];
}

/**
 * 2026-08-09 (Document Templates admin config, user request): the single combined read backing
 * the admin screen - every template, every Loan Product (for the mapping matrix's columns), and
 * the full mapping table, in one round trip. Mirrors Roles & Permissions' own `{roles,
 * permissions}` combined-read shape.
 */
export class ListDocumentTemplatesForAdminUseCase {
  constructor(private readonly deps: ListDocumentTemplatesForAdminUseCaseDeps) {}

  async execute(): Promise<DocumentTemplateAdminResult> {
    const [templates, mappings, loanProducts] = await Promise.all([
      this.deps.documentTemplateRepository.findAll(),
      this.deps.documentTemplateRepository.findAllProductMappings(),
      this.deps.loanProductRepository.findMany({ limit: 1000 }),
    ]);

    return {
      templates,
      loanProducts: loanProducts.map((p) => ({ id: p.id, code: p.code, name: p.name })),
      mappings,
    };
  }
}
