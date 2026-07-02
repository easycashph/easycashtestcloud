import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { CreateLoanAccountInput } from '../dtos/LoanAccountDtos';

export interface CreateLoanAccountUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

/**
 * Structural creation only, in PENDING_APPROVAL — no calculation engine
 * involved (out of scope for Milestone 7). Deliberately does NOT verify
 * that `loanProductVersionId` refers to the product's currently-Active
 * version — that check belongs to the loan-origination business workflow
 * this milestone does not build; adding it here would be inventing a rule
 * ahead of the calculation-engine milestone that actually needs it.
 */
export class CreateLoanAccountUseCase {
  constructor(private readonly deps: CreateLoanAccountUseCaseDeps) {}

  async execute(input: CreateLoanAccountInput): Promise<LoanAccount> {
    const loanAccount = LoanAccount.create({
      loanCode: input.loanCode,
      borrowerId: input.borrowerId,
      loanProductVersionId: input.loanProductVersionId,
      branchId: input.branchId,
      loanOfficerId: input.loanOfficerId,
      principalAmount: Money.of(input.principalAmount),
      interestRate: Percentage.of(input.interestRate),
      addOnInterestRate: input.addOnInterestRate ? Percentage.of(input.addOnInterestRate) : undefined,
      contractualInterestRate: input.contractualInterestRate ? Percentage.of(input.contractualInterestRate) : undefined,
      installmentCount: input.installmentCount,
      gracePeriodDays: input.gracePeriodDays,
      legacyId: input.legacyId,
    });

    await this.deps.loanAccountRepository.save(loanAccount);
    return loanAccount;
  }
}
