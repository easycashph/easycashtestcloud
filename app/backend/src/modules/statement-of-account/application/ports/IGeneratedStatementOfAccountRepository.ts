import type { TransactionContext } from '@shared/application/TransactionContext';
import type { GeneratedStatementOfAccount } from '../../domain/GeneratedStatementOfAccount';

/** Read-model for the SOA history list — resolves the generating user's display name via a join, avoiding an N+1 lookup from the frontend. */
export interface GeneratedStatementOfAccountView {
  id: string;
  loanAccountId: string;
  soaNumber: string;
  penaltyAsOfDate: Date;
  accruedInterestAsOfDate: Date;
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
  /** Global running counter across every loan account — see `GeneratedStatementOfAccount.soaSequenceNumber`'s own doc comment (schema.prisma) for why this is a read-then-use pattern, not a native DB sequence. */
  findMaxSoaSequenceNumber(ctx?: TransactionContext): Promise<number>;
}
