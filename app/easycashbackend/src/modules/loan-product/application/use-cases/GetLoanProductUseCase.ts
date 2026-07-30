import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanProduct } from '../../domain/LoanProduct';
import type { ILoanProductRepository } from '../ports/ILoanProductRepository';

export interface GetLoanProductUseCaseDeps {
  loanProductRepository: ILoanProductRepository;
}

export class GetLoanProductUseCase {
  constructor(private readonly deps: GetLoanProductUseCaseDeps) {}

  async execute(id: string): Promise<LoanProduct> {
    const product = await this.deps.loanProductRepository.findById(id);
    if (!product) {
      throw new NotFoundError('LoanProduct', id);
    }
    return product;
  }
}
