import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import { LoanAccount } from '../../domain/LoanAccount';
import { InstallmentCountOutOfRangeError, LoanAmountOutOfRangeError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { CreateLoanAccountInput } from '../dtos/LoanAccountDtos';

export interface CreateLoanAccountUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
}

/**
 * Structural creation only, in PENDING_APPROVAL — no calculation engine
 * involved (interest/amortization math is still out of scope).
 *
 * Milestone 8 / D-3: validates `principalAmount` and `installmentCount`
 * against the referenced LoanProductVersion's configured
 * loanAmountMin/Max and installmentCountMin/Max — this is configuration
 * validation against already-stored data, not financial calculation, and
 * closes a real gap: without it, HTTP-exposing this use case would let a
 * caller originate a loan wildly outside its product's configured limits
 * with zero enforcement. Does NOT verify `loanProductVersionId` refers to
 * the product's currently-Active version — that remains a deliberately
 * separate, still-open question (a version could be intentionally
 * reused for a renewal/restructure flow that doesn't exist yet).
 */
export class CreateLoanAccountUseCase {
  constructor(private readonly deps: CreateLoanAccountUseCaseDeps) {}

  async execute(input: CreateLoanAccountInput): Promise<LoanAccount> {
    const version = await this.deps.loanProductRepository.findVersionById(input.loanProductVersionId);
    if (!version) {
      throw new NotFoundError('LoanProductVersion', input.loanProductVersionId);
    }

    const principalAmount = Money.of(input.principalAmount);
    if (
      principalAmount.lessThan(version.loanAmountMin) ||
      (version.loanAmountMax && principalAmount.greaterThan(version.loanAmountMax))
    ) {
      throw new LoanAmountOutOfRangeError(
        principalAmount.toString(),
        version.loanAmountMin.toString(),
        version.loanAmountMax?.toString(),
      );
    }

    if (
      input.installmentCount < version.installmentCountMin ||
      (version.installmentCountMax !== undefined && input.installmentCount > version.installmentCountMax)
    ) {
      throw new InstallmentCountOutOfRangeError(
        input.installmentCount,
        version.installmentCountMin,
        version.installmentCountMax,
      );
    }

    const loanAccount = LoanAccount.create({
      loanCode: input.loanCode,
      borrowerId: input.borrowerId,
      loanProductVersionId: input.loanProductVersionId,
      branchId: input.branchId,
      loanOfficerId: input.loanOfficerId,
      principalAmount,
      interestRate: Percentage.of(input.interestRate),
      addOnInterestRate: input.addOnInterestRate ? Percentage.of(input.addOnInterestRate) : undefined,
      contractualInterestRate: input.contractualInterestRate ? Percentage.of(input.contractualInterestRate) : undefined,
      installmentCount: input.installmentCount,
      gracePeriodDays: input.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
      legacyId: input.legacyId,
    });

    await this.deps.loanAccountRepository.save(loanAccount);
    return loanAccount;
  }
}
