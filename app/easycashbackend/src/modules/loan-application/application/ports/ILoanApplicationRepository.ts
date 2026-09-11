import type { LoanApplication, LoanApplicationStatus } from '../../domain/LoanApplication';
import type { TransactionContext } from '@shared/application/TransactionContext';

export interface FindManyLoanApplicationsOptions {
  limit: number;
  cursor?: string;
  branchId?: string;
  /** Case-insensitive match against applicantName. */
  search?: string;
  status?: LoanApplicationStatus;
  requestedCategory?: string;
  /** 2026-09-11 (user request): filter by `createdAt` (Submitted date) - both inclusive, matching
   * the Loan Applications list page's date-range filter. */
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ILoanApplicationRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanApplication | null>;
  findMany(options: FindManyLoanApplicationsOptions, ctx?: TransactionContext): Promise<LoanApplication[]>;
  findByBorrowerId(borrowerId: string, ctx?: TransactionContext): Promise<LoanApplication[]>;
  findByPortalAccountId(portalAccountId: string, ctx?: TransactionContext): Promise<LoanApplication[]>;
  save(application: LoanApplication, ctx?: TransactionContext): Promise<void>;
  /** True if a Borrower or LoanAccount has already been created from this application
   * (Borrower.sourceApplicationId / LoanAccount.sourceApplicationId) - deletion must be blocked
   * in that case, since those FKs are ON DELETE SET NULL and would otherwise silently orphan a
   * real client/loan record instead of failing loudly. */
  hasDownstreamRecords(id: string, ctx?: TransactionContext): Promise<boolean>;
  /** Hard delete - also removes this application's ProfileActivityLog rows (polymorphic, no FK).
   * Attachment rows/files are deliberately left in place (no delete-attachment capability exists
   * anywhere else in this codebase yet; they become inert once the application is gone). */
  delete(id: string, ctx?: TransactionContext): Promise<void>;
}
