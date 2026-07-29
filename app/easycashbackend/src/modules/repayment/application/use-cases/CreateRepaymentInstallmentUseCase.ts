import { Money } from '@shared/domain/Money';
import { RepaymentInstallment } from '../../domain/RepaymentInstallment';
import { InstallmentAmounts } from '../../domain/valueObjects/InstallmentAmounts';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { CreateRepaymentInstallmentInput } from '../dtos/RepaymentDtos';

export interface CreateRepaymentInstallmentUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

/**
 * Creates ONE installment record with already-decided due amounts —
 * generating a full amortization schedule from principal/rate/term is the
 * (out of scope) calculation engine's job. This is the structural
 * recording primitive that engine will call once built.
 */
export class CreateRepaymentInstallmentUseCase {
  constructor(private readonly deps: CreateRepaymentInstallmentUseCaseDeps) {}

  async execute(input: CreateRepaymentInstallmentInput): Promise<RepaymentInstallment> {
    const installment = RepaymentInstallment.create({
      loanAccountId: input.loanAccountId,
      installmentNumber: input.installmentNumber,
      dueDate: input.dueDate,
      due: InstallmentAmounts.of({
        principal: Money.of(input.principalDue),
        interest: input.interestDue ? Money.of(input.interestDue) : undefined,
        fees: input.feesDue ? Money.of(input.feesDue) : undefined,
        penalty: input.penaltyDue ? Money.of(input.penaltyDue) : undefined,
      }),
      legacyId: input.legacyId,
    });

    await this.deps.repaymentInstallmentRepository.save(installment);
    return installment;
  }
}
