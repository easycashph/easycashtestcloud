import type { TransactionContext } from '@shared/application/TransactionContext';
import type { DocumentTemplate } from '../../domain/DocumentTemplate';

export interface IDocumentTemplateRepository {
  findById(id: string, ctx?: TransactionContext): Promise<DocumentTemplate | null>;
  findByCode(code: string, ctx?: TransactionContext): Promise<DocumentTemplate | null>;
  /** ADR-051 §1: applies to every loan, no per-product mapping involved. */
  findRequired(ctx?: TransactionContext): Promise<DocumentTemplate[]>;
  /** ADR-051 §1/§3: the conditional templates linked to this specific Loan Product via `DocumentTemplateMapping`. */
  findConditionalForLoanProduct(loanProductId: string, ctx?: TransactionContext): Promise<DocumentTemplate[]>;
}
