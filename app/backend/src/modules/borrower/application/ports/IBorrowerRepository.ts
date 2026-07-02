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
export interface IBorrowerRepository {
  findById(id: string, ctx?: TransactionContext): Promise<Borrower | null>;
  save(borrower: Borrower, ctx?: TransactionContext): Promise<void>;
}
