import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { LoanAccount } from '../../domain/LoanAccount';
import { InstallmentCountOutOfRangeError, LoanAmountOutOfRangeError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { UpdateLoanAccountInput } from '../dtos/LoanAccountDtos';

export interface UpdateLoanAccountUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
}

const FEE_FIELDS = [
  'processingFee',
  'advanceInterestFee',
  'outstandingBalancePayoff',
  'docStampFee',
  'accountManagementFee',
  'otherFees',
  'notarialFee',
  'webFee',
  'insuranceFee',
] as const;

/**
 * 2026-07-16 (Edit Loan Account, user request): "may kailangan baguhin katulad ng term or amount,
 * dapat pwede ko ito i-edit hangga't before ma-approve." Refused entirely once the loan is past
 * PENDING_APPROVAL — see `LoanAccountNotEditableError`'s own doc comment — enforced by
 * `LoanAccount.update()` itself (LA-2 precedent: the entity decides what's legal, not the use
 * case), not duplicated here.
 *
 * Mirrors `CreateLoanAccountUseCase`'s D-3 range validation against the (possibly newly-selected)
 * `LoanProductVersion`'s configured `loanAmountMin/Max`/`installmentCountMin/Max` — re-validates
 * even fields the caller didn't touch this call, since changing `loanProductVersionId` alone could
 * put an untouched `principalAmount`/`installmentCount` outside the new version's range.
 */
export class UpdateLoanAccountUseCase {
  constructor(private readonly deps: UpdateLoanAccountUseCaseDeps) {}

  async execute(id: string, input: UpdateLoanAccountInput): Promise<LoanAccount> {
    const loanAccount = await this.deps.loanAccountRepository.findById(id);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', id);
    }

    const loanProductVersionId = input.loanProductVersionId ?? loanAccount.loanProductVersionId;
    const version = await this.deps.loanProductRepository.findVersionById(loanProductVersionId);
    if (!version) {
      throw new NotFoundError('LoanProductVersion', loanProductVersionId);
    }

    const principalAmount = input.principalAmount !== undefined ? Money.of(input.principalAmount) : loanAccount.principalAmount;
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

    const installmentCount = input.installmentCount ?? loanAccount.installmentCount;
    if (
      installmentCount < version.installmentCountMin ||
      (version.installmentCountMax !== undefined && installmentCount > version.installmentCountMax)
    ) {
      throw new InstallmentCountOutOfRangeError(installmentCount, version.installmentCountMin, version.installmentCountMax);
    }

    // Merge any supplied fee sub-fields onto the existing OriginationFees — see this use case's
    // own doc comment (via LoanAccountDtos.UpdateLoanAccountInput) for why a caller editing one
    // fee shouldn't have to resend the other eight.
    const anyFeeSupplied = FEE_FIELDS.some((field) => input[field] !== undefined);
    const existingFees = loanAccount.originationFees.toProps();
    const originationFees = anyFeeSupplied
      ? {
          processingFee: Money.of(input.processingFee ?? existingFees.processingFee.toString()),
          advanceInterestFee: Money.of(input.advanceInterestFee ?? existingFees.advanceInterestFee.toString()),
          outstandingBalancePayoff: Money.of(input.outstandingBalancePayoff ?? existingFees.outstandingBalancePayoff.toString()),
          docStampFee: Money.of(input.docStampFee ?? existingFees.docStampFee.toString()),
          accountManagementFee: Money.of(input.accountManagementFee ?? existingFees.accountManagementFee.toString()),
          otherFees: Money.of(input.otherFees ?? existingFees.otherFees.toString()),
          notarialFee: Money.of(input.notarialFee ?? existingFees.notarialFee.toString()),
          webFee: Money.of(input.webFee ?? existingFees.webFee.toString()),
          insuranceFee: Money.of(input.insuranceFee ?? existingFees.insuranceFee.toString()),
        }
      : undefined;

    loanAccount.update({
      loanProductVersionId: input.loanProductVersionId,
      principalAmount: input.principalAmount !== undefined ? principalAmount : undefined,
      interestRate: input.interestRate !== undefined ? Percentage.of(input.interestRate) : undefined,
      addOnInterestRate: input.addOnInterestRate !== undefined ? Percentage.of(input.addOnInterestRate) : undefined,
      contractualInterestRate: input.contractualInterestRate !== undefined ? Percentage.of(input.contractualInterestRate) : undefined,
      installmentCount: input.installmentCount,
      gracePeriodDays: input.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
      anticipatedDisbursementDate: input.anticipatedDisbursementDate,
      originationFees,
    });

    await this.deps.loanAccountRepository.save(loanAccount);
    return loanAccount;
  }
}
