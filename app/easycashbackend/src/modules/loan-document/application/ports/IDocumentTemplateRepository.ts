import type { TransactionContext } from '@shared/application/TransactionContext';
import type { DocumentTemplate } from '../../domain/DocumentTemplate';

export interface DocumentTemplateProductMapping {
  documentTemplateId: string;
  loanProductId: string;
}

export interface IDocumentTemplateRepository {
  findById(id: string, ctx?: TransactionContext): Promise<DocumentTemplate | null>;
  findByCode(code: string, ctx?: TransactionContext): Promise<DocumentTemplate | null>;
  /** ADR-051 §1: applies to every loan, no per-product mapping involved. */
  findRequired(ctx?: TransactionContext): Promise<DocumentTemplate[]>;
  /** ADR-051 §1/§3: the conditional templates linked to this specific Loan Product via `DocumentTemplateMapping`. */
  findConditionalForLoanProduct(loanProductId: string, ctx?: TransactionContext): Promise<DocumentTemplate[]>;
  /** 2026-08-09 (Document Templates admin config): every template, required and conditional alike, ordered by `sortIndex` - backs the admin config screen. */
  findAll(ctx?: TransactionContext): Promise<DocumentTemplate[]>;
  /** 2026-08-09 (Document Templates admin config): persists `setRequired()` - the only field this entity's admin path ever changes. */
  update(template: DocumentTemplate, ctx?: TransactionContext): Promise<void>;
  /** 2026-08-09 (Document Templates admin config): the whole `DocumentTemplateMapping` table in one call - small (12 templates x <=~43 products), so the admin screen's GET is a single round trip. */
  findAllProductMappings(ctx?: TransactionContext): Promise<DocumentTemplateProductMapping[]>;
  /** 2026-08-09 (Document Templates admin config): wholesale-replaces the mapping set for one template (delete-all-then-recreate, same pattern as `LoanAccountCoBorrower`). Caller (`SetDocumentTemplateProductMappingsUseCase`) is responsible for refusing this on a currently-Required template. */
  setProductMappings(templateId: string, loanProductIds: string[], ctx?: TransactionContext): Promise<void>;
}
