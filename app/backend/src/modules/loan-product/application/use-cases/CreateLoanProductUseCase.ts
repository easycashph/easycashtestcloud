import { LoanProduct } from '../../domain/LoanProduct';
import type { ILoanProductRepository } from '../ports/ILoanProductRepository';
import type { CreateLoanProductInput } from '../dtos/LoanProductDtos';

export interface CreateLoanProductUseCaseDeps {
  loanProductRepository: ILoanProductRepository;
}

export class CreateLoanProductUseCase {
  constructor(private readonly deps: CreateLoanProductUseCaseDeps) {}

  async execute(input: CreateLoanProductInput): Promise<LoanProduct> {
    const product = LoanProduct.create(input);
    await this.deps.loanProductRepository.save(product);
    return product;
  }
}
