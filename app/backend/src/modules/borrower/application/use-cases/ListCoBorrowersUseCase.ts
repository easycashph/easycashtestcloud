import type { CoBorrower } from '../../domain/CoBorrower';
import type { ICoBorrowerRepository } from '../ports/ICoBorrowerRepository';

export interface ListCoBorrowersUseCaseDeps {
  coBorrowerRepository: ICoBorrowerRepository;
}

/** 2026-07-25 - every co-borrower attached to one client (ADR-015: per-Borrower, not per-loan),
 * for the Client Profile page's "Co-Borrowers" card. */
export class ListCoBorrowersUseCase {
  constructor(private readonly deps: ListCoBorrowersUseCaseDeps) {}

  async execute(borrowerId: string): Promise<CoBorrower[]> {
    return this.deps.coBorrowerRepository.findByBorrowerId(borrowerId);
  }
}
