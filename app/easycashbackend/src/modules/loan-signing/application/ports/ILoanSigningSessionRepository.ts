import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanSigningSession } from '../../domain/LoanSigningSession';

export interface ILoanSigningSessionRepository {
  create(session: LoanSigningSession, ctx?: TransactionContext): Promise<void>;
  findByTokenHash(tokenHash: string, ctx?: TransactionContext): Promise<LoanSigningSession | null>;
  findById(id: string, ctx?: TransactionContext): Promise<LoanSigningSession | null>;
  findManyByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanSigningSession[]>;
  /** Persists OTP fields and per-document signed fields - the session's identity/token/expiry
   * never change after `create()`, only these mutable fields do. */
  save(session: LoanSigningSession, ctx?: TransactionContext): Promise<void>;
}
