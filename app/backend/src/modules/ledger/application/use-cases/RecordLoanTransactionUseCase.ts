import { Money } from '@shared/domain/Money';
import { LoanTransaction } from '../../domain/LoanTransaction';
import type { ILoanTransactionRepository } from '../ports/ILoanTransactionRepository';
import type { RecordLoanTransactionInput } from '../dtos/LedgerDtos';

export interface RecordLoanTransactionUseCaseDeps {
  loanTransactionRepository: ILoanTransactionRepository;
}

/**
 * Records an ALREADY-COMPUTED transaction — this use case does not derive
 * `amount`, component splits, or `balanceAfter` itself. It is the
 * structural recording primitive a future calculation/payment-allocation
 * engine will call once built (both explicitly out of scope for Milestone
 * 7); today it exists so the ledger module's append-only repository
 * contract and TXN-2 component-sum integrity check are exercised.
 */
export class RecordLoanTransactionUseCase {
  constructor(private readonly deps: RecordLoanTransactionUseCaseDeps) {}

  async execute(input: RecordLoanTransactionInput): Promise<LoanTransaction> {
    const transaction = LoanTransaction.create({
      loanAccountId: input.loanAccountId,
      type: input.type,
      amount: Money.of(input.amount),
      components: {
        principalComponent: input.principalComponent ? Money.of(input.principalComponent) : undefined,
        interestComponent: input.interestComponent ? Money.of(input.interestComponent) : undefined,
        feesComponent: input.feesComponent ? Money.of(input.feesComponent) : undefined,
        penaltyComponent: input.penaltyComponent ? Money.of(input.penaltyComponent) : undefined,
      },
      balanceAfter: Money.of(input.balanceAfter),
      postedByUserId: input.postedByUserId,
      branchId: input.branchId,
      entryDate: input.entryDate,
      comment: input.comment,
      reversesTransactionId: input.reversesTransactionId,
      legacyId: input.legacyId,
    });

    await this.deps.loanTransactionRepository.create(transaction);
    return transaction;
  }
}
