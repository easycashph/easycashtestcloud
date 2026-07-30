import type { LoanProduct } from '../../domain/LoanProduct';
import type { ILoanProductRepository } from '../ports/ILoanProductRepository';

export interface ListLoanProductsUseCaseDeps {
  loanProductRepository: ILoanProductRepository;
}

export interface ListLoanProductsInput {
  limit: number;
  cursor?: string;
}

export class ListLoanProductsUseCase {
  constructor(private readonly deps: ListLoanProductsUseCaseDeps) {}

  async execute(input: ListLoanProductsInput): Promise<LoanProduct[]> {
    return this.deps.loanProductRepository.findMany(input);
  }
}
