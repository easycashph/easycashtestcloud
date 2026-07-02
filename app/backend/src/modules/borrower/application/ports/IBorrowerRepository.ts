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
  /** Cursor-paginated (Milestone 8 / D-4: limit + cursor only, no search/filter/sort). */
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
}

export interface IBorrowerRepository {
  findById(id: string, ctx?: TransactionContext): Promise<Borrower | null>;
  findMany(options: FindManyBorrowersOptions, ctx?: TransactionContext): Promise<Borrower[]>;
  save(borrower: Borrower, ctx?: TransactionContext): Promise<void>;
}
