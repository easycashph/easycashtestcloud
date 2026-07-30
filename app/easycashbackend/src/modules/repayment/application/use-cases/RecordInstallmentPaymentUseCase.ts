import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from '../../domain/valueObjects/InstallmentAmounts';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { RecordInstallmentPaymentInput } from '../dtos/RepaymentDtos';

export interface RecordInstallmentPaymentUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

/**
 * Applies an ALREADY-DECIDED payment split to a single installment.
 * Deciding how a payment splits across MULTIPLE installments (oldest-due-
 * first, etc.) is the payment allocation algorithm's job (ADR-009,
 * explicitly out of scope for Milestone 7) — this use case only performs
 * the single-installment write that algorithm will call once built.
 */
export class RecordInstallmentPaymentUseCase {
  constructor(private readonly deps: RecordInstallmentPaymentUseCaseDeps) {}

  async execute(input: RecordInstallmentPaymentInput): Promise<void> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(input.installmentId);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', input.installmentId);
    }

    installment.recordPayment(
      InstallmentAmounts.of({
        principal: input.principal ? Money.of(input.principal) : undefined,
        interest: input.interest ? Money.of(input.interest) : undefined,
        fees: input.fees ? Money.of(input.fees) : undefined,
        penalty: input.penalty ? Money.of(input.penalty) : undefined,
      }),
      input.paidAt,
    );

    await this.deps.repaymentInstallmentRepository.save(installment);
  }
}
