import type { TransactionContext } from '@shared/application/TransactionContext';
import type { GeneratedStatementOfAccount, SoaPenaltyMode } from '../../domain/GeneratedStatementOfAccount';

/** Read-model for the SOA history list — resolves the generating user's display name via a join, avoiding an N+1 lookup from the frontend. */
export interface GeneratedStatementOfAccountView {
  id: string;
  loanAccountId: string;
  soaNumber: string;
  penaltyMode: SoaPenaltyMode;
  /** Both null under `RECORDED` — that mode asks staff for no penalty dates. */
  penaltyFromDate: Date | null;
  penaltyToDate: Date | null;
  /** Set only under `MANUAL` — why the figure differs from the schedule. */
  penaltyManualReason: string | null;
  accruedInterestAsOfDate: Date;
  /** 2026-08-06 (user-reported): lets the frontend hide "Penalty {range}" / "Accrued Interest as
   * of {date}" whenever the respective amount is genuinely zero (e.g. a non-matured loan has no
   * accrued interest) - same treatment already applied to the printed .docx's date fields. */
  pastDuePenalty: string;
  accruedInterest: string;
  totalAmountDue: string;
  generatedByUserId: string;
  generatedByName: string;
  generatedAt: Date;
}

export interface IGeneratedStatementOfAccountRepository {
  create(statement: GeneratedStatementOfAccount, ctx?: TransactionContext): Promise<void>;
  findById(id: string, ctx?: TransactionContext): Promise<GeneratedStatementOfAccount | null>;
  /** Newest first — mirrors `IGeneratedLoanDocumentRepository`'s history convention. */
  findAllForLoanAccount(loanAccountId: string, ctx?: TransactionContext): Promise<GeneratedStatementOfAccountView[]>;
  /** PER-LOAN-ACCOUNT running counter (matches the legacy tool's own `wsLoan.Cells(r, 26)` column — confirmed 2026-07-19 against its actual VBA source, correcting an earlier "global" assumption) — see `GeneratedStatementOfAccount.soaSequenceNumber`'s own doc comment (schema.prisma) for why this is a read-then-use pattern, not a native DB sequence. */
  findMaxSoaSequenceNumber(loanAccountId: string, ctx?: TransactionContext): Promise<number>;
}
