import type { RepaymentInstallment } from '../../domain/RepaymentInstallment';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';

export interface ListRepaymentInstallmentsForLoanUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

export class ListRepaymentInstallmentsForLoanUseCase {
  constructor(private readonly deps: ListRepaymentInstallmentsForLoanUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<RepaymentInstallment[]> {
    return this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
  }
}
