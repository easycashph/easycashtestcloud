import type { TransactionContext } from '@shared/application/TransactionContext';
import type { Borrower } from '../../domain/Borrower';

/**
 * Every mutating method accepts an optional TransactionContext so a future
 * multi-aggregate use case can save a Borrower as part of a wider
 * IUnitOfWork transaction (ADR-042 §9) without this port's shape changing
 * later. No such use case exists yet in Milestone 7 — Borrower has no
 * financial fields, so nothing here currently requires cross-aggregate
 * atomicity — but the port is transaction-ready from the start.
 */
export interface FindManyBorrowersOptions {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
  /** Case-insensitive match against firstName/middleName/lastName/email/mobilePhone1/mobilePhone2. */
  search?: string;
  /** 2026-07-16 (List of Clients "Loan presence" filter): WITH_ACTIVE = has a LoanAccount whose
   * status is ACTIVE/ACTIVE_IN_ARREARS; WITH_HISTORY = has any LoanAccount at all; NONE = has
   * none. Pushed server-side so a filtered view shows a full page of matches instead of narrowing
   * whatever page had already been fetched. */
  loanPresence?: 'WITH_ACTIVE' | 'WITH_HISTORY' | 'NONE';
  /** 2026-08-26 (List of Clients "Date Created" sort): server-side so the ordering spans every
   * matching borrower, not just whichever page happened to already be fetched - the client-side
   * `useSortableTable` used elsewhere only reorders the current page. Defaults to `'desc'`
   * (existing behavior, newest first) when omitted. */
  sortDirection?: 'asc' | 'desc';
}

export interface IBorrowerRepository {
  findById(id: string, ctx?: TransactionContext): Promise<Borrower | null>;
  findMany(options: FindManyBorrowersOptions, ctx?: TransactionContext): Promise<Borrower[]>;
  /** Looks up the borrower created from a given LoanApplication via "Create Client Profile", if any. */
  findBySourceApplicationId(applicationId: string, ctx?: TransactionContext): Promise<Borrower | null>;
  /** Batched form of `findBySourceApplicationId` for list views - one query for N applications. */
  findManyBySourceApplicationIds(applicationIds: string[], ctx?: TransactionContext): Promise<Borrower[]>;
  /** Case-insensitive exact match on `Borrower.email` (2026-08-06, Bind existing Client data to
   * Portal). `email` has no uniqueness constraint - callers must handle 0/1/2+ results themselves
   * (see `matchBorrowerByEmail` in `application/services/MatchBorrowerByEmail.ts`), never assume a
   * single match. */
  findManyByEmail(email: string, ctx?: TransactionContext): Promise<Borrower[]>;
  save(borrower: Borrower, ctx?: TransactionContext): Promise<void>;
  /** 2026-08-24 (MIS bulk document export): lightweight id+display-name pairs for every Borrower
   * whose `createdAt` falls within `[from, to]`, no joins - avoids materializing full `Borrower`
   * domain objects (income detail, addresses, etc.) for a job that may touch thousands of rows. */
  findManyCreatedBetween(from: Date, to: Date, branchId: string | undefined, ctx?: TransactionContext): Promise<{ id: string; displayName: string }[]>;
  /** Earliest `createdAt` across all Borrowers, or `null` if there are none - used to compute the
   * bulk-export date-range picker's default start date (first day of that month). */
  findEarliestCreatedAt(ctx?: TransactionContext): Promise<Date | null>;
  /** CIC monthly report (2026-08-30, user-confirmed): assigns a fresh, permanent
   * `cicProviderSubjectNo` to this borrower if it doesn't already have one - a no-op otherwise.
   * Only ever called for genuinely NEW borrowers (CreateBorrowerUseCase) - never call this for a
   * borrower migrated from legacy data, which must get its real historical value (if any) from
   * `backfill-cic-provider-subject-no.ts` instead, never a freshly generated one. */
  assignCicProviderSubjectNoIfMissing(borrowerId: string, ctx?: TransactionContext): Promise<void>;
}
