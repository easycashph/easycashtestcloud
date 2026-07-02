import type { Borrower } from '../../domain/Borrower';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export interface ListBorrowersUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
}

export interface ListBorrowersInput {
  limit: number;
  cursor?: string;
}

export class ListBorrowersUseCase {
  constructor(private readonly deps: ListBorrowersUseCaseDeps) {}

  async execute(input: ListBorrowersInput): Promise<Borrower[]> {
    return this.deps.borrowerRepository.findMany(input);
  }
}
