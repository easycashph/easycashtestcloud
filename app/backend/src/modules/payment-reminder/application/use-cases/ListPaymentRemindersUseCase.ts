import type { IPaymentReminderRepository, PaymentReminderCandidate } from '../ports/IPaymentReminderRepository';

export class ListPaymentRemindersUseCase {
  constructor(private readonly deps: { paymentReminderRepository: IPaymentReminderRepository }) {}

  async execute(branchId: string | undefined): Promise<PaymentReminderCandidate[]> {
    return this.deps.paymentReminderRepository.findNextDueInstallments(branchId);
  }
}
