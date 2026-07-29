import { NotFoundError } from '@shared/errors/DomainError';
import type { RepaymentInstallment } from '../../domain/RepaymentInstallment';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';

export interface GetRepaymentInstallmentUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

export class GetRepaymentInstallmentUseCase {
  constructor(private readonly deps: GetRepaymentInstallmentUseCaseDeps) {}

  async execute(id: string): Promise<RepaymentInstallment> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(id);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', id);
    }
    return installment;
  }
}
