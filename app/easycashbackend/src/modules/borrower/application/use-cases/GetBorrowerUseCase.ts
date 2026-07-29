import { NotFoundError } from '@shared/errors/DomainError';
import type { Borrower } from '../../domain/Borrower';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export interface GetBorrowerUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
}

export class GetBorrowerUseCase {
  constructor(private readonly deps: GetBorrowerUseCaseDeps) {}

  async execute(id: string): Promise<Borrower> {
    const borrower = await this.deps.borrowerRepository.findById(id);
    if (!borrower) {
      throw new NotFoundError('Borrower', id);
    }
    return borrower;
  }
}
