import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAccount, LoanAccountStatus } from '../../domain/LoanAccount';

export interface FindManyLoanAccountsOptions {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
  /** Case-insensitive match against loanCode or the borrower's first/last name. */
  search?: string;
  /** Frontend↔Backend Wiring Pilot follow-up (2026-07-09): filters to one borrower's loan history — read-only, combinable with branchId. */
  borrowerId?: string;
  /** 2026-07-16 (List of Loan Accounts status/product filters): equality against `status`, plus a
   * pseudo-status `'MATURED'` - not a real `LoanAccountStatus` (it's a computed overlay, same
   * definition as `findMaturedLoanAccountIds`/the "Matured" badge - full term ended, still unpaid),
   * but staff need to filter by it directly, and filtering ACTIVE/ACTIVE_IN_ARREARS by the raw
   * status alone let already-Matured loans mix into those views (they're still raw-status
   * ACTIVE_IN_ARREARS underneath, just displayed as "Matured" instead). `findMany` excludes matured
   * loans from a plain ACTIVE/ACTIVE_IN_ARREARS filter and includes only them for `'MATURED'`. */
  status?: LoanAccountStatus | 'MATURED';
  /** 2026-07-16: the frontend resolves a selected Product Class to every one of its
   * `LoanProductVersion` ids (a product can have several versions over time) and filters by that
   * set - avoids needing a product-name join here. */
  loanProductVersionIds?: string[];
}

export interface ILoanAccountRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findMany(options: FindManyLoanAccountsOptions, ctx?: TransactionContext): Promise<LoanAccount[]>;
  /**
   * 2026-07-16: the loan account created FROM this specific LoanApplication, if any — mirrors
   * `IBorrowerRepository.findBySourceApplicationId`'s identical shape/rationale. Replaces
   * `loanApplicationController.buildLinkage()`'s previous "this borrower's most recent loan
   * account" heuristic, which falsely matched an older, unrelated loan account for any borrower
   * who already had one on file before this application was approved.
   */
  findBySourceApplicationId(applicationId: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  /** Batched form of `findBySourceApplicationId` for list views - one query for N applications. */
  findManyBySourceApplicationIds(applicationIds: string[], ctx?: TransactionContext): Promise<LoanAccount[]>;
  /**
   * 2026-07-11 (Create Loan Account): the highest numeric suffix among existing loan codes of the
   * form `{prefix}_NNNNN` (matches the real convention observed across migrated legacy data, e.g.
   * `SML-REG_00377`) — 0 if none exist yet. Used to auto-generate the next code; not atomic against
   * concurrent creates for the same prefix (acceptable for a low-frequency, staff-driven action,
   * not a high-throughput one).
   */
  findMaxLoanCodeSequenceForPrefix(prefix: string, ctx?: TransactionContext): Promise<number>;
  /**
   * Milestone 9.1 checkpoint 6 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: for an existing aggregate, throws
   * `ConcurrencyConflictError` if `loanAccount.version` no longer matches
   * the persisted row (another writer moved it forward since this
   * aggregate was loaded). The caller must not blindly retry with the
   * same stale instance — re-fetch and re-apply the intended change.
   */
  save(loanAccount: LoanAccount, ctx?: TransactionContext): Promise<void>;
  /**
   * 2026-07-13: "Matured" per Investopedia's definition - the loan's full scheduled term has
   * ended (its last installment's due date has passed) and it's still unpaid, distinct from
   * "in arrears" (a still-mid-term loan with a missed payment). Mirrors
   * `PrismaDashboardRepository.findOverdueLoanAccounts`'s identical maturity computation, scoped
   * to a specific set of loan ids instead of a branch, so both surfaces agree on the same
   * definition. Batched (one query for N ids) to avoid N+1 on the loan-accounts list endpoint.
   */
  findMaturedLoanAccountIds(loanAccountIds: string[], ctx?: TransactionContext): Promise<Set<string>>;
  /**
   * 2026-08-08 (Undo Restructure / Undo Adjustment feature, user-confirmed): deletes a LoanAccount
   * row outright. Narrowly scoped to `UndoRestructureLoanUseCase`/`UndoAdjustLoanUseCase` deleting
   * the NEW loan a restructure/adjustment created, only once confirmed to have no repayment/
   * penalty/fee activity - callers must delete its `RepaymentInstallment`/`LoanTransaction` rows
   * (and the `LoanRestructure`/`LoanAdjustment` row that references it) first, in the same
   * transaction.
   */
  delete(id: string, ctx?: TransactionContext): Promise<void>;
  /** 2026-08-24 (MIS bulk document export): lightweight id+loanCode pairs for every LoanAccount
   * whose `createdAt` falls within `[from, to]`, no joins - mirrors
   * `IBorrowerRepository.findManyCreatedBetween`'s identical reasoning. */
  findManyCreatedBetween(from: Date, to: Date, branchId: string | undefined, ctx?: TransactionContext): Promise<{ id: string; loanCode: string }[]>;
  /** Earliest `createdAt` across all LoanAccounts, or `null` if there are none - used to compute the
   * bulk-export date-range picker's default start date. */
  findEarliestCreatedAt(ctx?: TransactionContext): Promise<Date | null>;
}
