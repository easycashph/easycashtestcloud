import type { Borrower } from '../../domain/Borrower';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export interface ListBorrowersUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
}

export interface ListBorrowersInput {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: set for a branch-scoped caller, omitted for a global caller. */
  branchId?: string;
}

export class ListBorrowersUseCase {
  constructor(private readonly deps: ListBorrowersUseCaseDeps) {}

  async execute(input: ListBorrowersInput): Promise<Borrower[]> {
    return this.deps.borrowerRepository.findMany(input);
  }
}
