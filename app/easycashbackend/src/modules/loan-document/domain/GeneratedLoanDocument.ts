import { randomUUID } from 'node:crypto';

export interface GeneratedLoanDocumentProps {
  id: string;
  loanAccountId: string;
  documentTemplateId: string;
  storageKey: string;
  generatedByUserId: string;
  generatedAt: Date;
}

export interface CreateGeneratedLoanDocumentProps {
  loanAccountId: string;
  documentTemplateId: string;
  storageKey: string;
  generatedByUserId: string;
}

/**
 * ADR-051 §3: append-only, like `LoanTransaction`/`LoanNote`/`PaymentAllocation` — "Regenerate" in
 * the UI always creates a new row, never overwrites one, so a document a borrower already saw or
 * signed is never erased from the record by a later correction.
 */
export class GeneratedLoanDocument {
  private constructor(private readonly props: GeneratedLoanDocumentProps) {}

  static create(input: CreateGeneratedLoanDocumentProps): GeneratedLoanDocument {
    return new GeneratedLoanDocument({
      id: randomUUID(),
      loanAccountId: input.loanAccountId,
      documentTemplateId: input.documentTemplateId,
      storageKey: input.storageKey,
      generatedByUserId: input.generatedByUserId,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: GeneratedLoanDocumentProps): GeneratedLoanDocument {
    return new GeneratedLoanDocument(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get documentTemplateId(): string {
    return this.props.documentTemplateId;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get generatedByUserId(): string {
    return this.props.generatedByUserId;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}
