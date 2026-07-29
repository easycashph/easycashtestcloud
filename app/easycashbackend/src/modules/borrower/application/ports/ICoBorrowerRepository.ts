import type { TransactionContext } from '@shared/application/TransactionContext';
import type { CoBorrower } from '../../domain/CoBorrower';

export interface ICoBorrowerRepository {
  findById(id: string, ctx?: TransactionContext): Promise<CoBorrower | null>;
  /** 2026-07-16 (ADR-015 resolved: per-Borrower) — every co-borrower directly attached to this client. */
  findByBorrowerId(borrowerId: string, ctx?: TransactionContext): Promise<CoBorrower[]>;
  save(coBorrower: CoBorrower, ctx?: TransactionContext): Promise<void>;
}
