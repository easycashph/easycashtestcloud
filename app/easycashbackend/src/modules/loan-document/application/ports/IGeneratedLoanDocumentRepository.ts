import type { TransactionContext } from '@shared/application/TransactionContext';
import type { GeneratedLoanDocument } from '../../domain/GeneratedLoanDocument';

/** Read-model for the Documents tab — resolves the template name/code and generating user's display name via joins, avoiding N+1 lookups from the frontend. */
export interface GeneratedLoanDocumentView {
  id: string;
  loanAccountId: string;
  documentTemplateId: string;
  documentTemplateCode: string;
  documentTemplateName: string;
  generatedByUserId: string;
  generatedByName: string;
  generatedAt: Date;
}

export interface IGeneratedLoanDocumentRepository {
  create(document: GeneratedLoanDocument, ctx?: TransactionContext): Promise<void>;
  findById(id: string, ctx?: TransactionContext): Promise<GeneratedLoanDocument | null>;
  /** One row per `documentTemplateId` — the most recently generated one — newest generation first. */
  findLatestPerTemplateForLoanAccount(loanAccountId: string, ctx?: TransactionContext): Promise<GeneratedLoanDocumentView[]>;
}
