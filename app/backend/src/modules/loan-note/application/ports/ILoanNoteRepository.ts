import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanNote } from '../../domain/LoanNote';

/**
 * Read-model for display purposes only — includes the author's resolved display name via a join,
 * rather than making the frontend fetch each `User` separately (the same N+1 pattern already found
 * and fixed once in Payment Recording's borrower lookups — avoided here from the start).
 */
export interface LoanNoteView {
  id: string;
  loanAccountId: string;
  authorUserId: string;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface ILoanNoteRepository {
  create(note: LoanNote, ctx?: TransactionContext): Promise<void>;
  /** Newest first — matches every other activity-feed-style listing in this app (Payment History, Activity Logs). */
  findByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanNoteView[]>;
  findById(id: string, ctx?: TransactionContext): Promise<LoanNote | null>;
  /**
   * 2026-07-11 (user request): unlike every other append-only record in this system
   * (LoanTransaction, PaymentAllocation, AppliedFee), a note IS permanently, physically deletable
   * — MIS-only, explicit user decision. The audit trail lives in `IAuditLogger` (see
   * `DeleteLoanNoteUseCase`), which records the deleted note's content in `previousValue` before
   * this call removes the row, not in the `loan_notes` table itself.
   */
  delete(id: string, ctx?: TransactionContext): Promise<void>;
}
