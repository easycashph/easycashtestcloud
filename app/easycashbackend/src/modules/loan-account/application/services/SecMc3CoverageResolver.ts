import { NotFoundError } from '@shared/errors/DomainError';
import { isSecMc3Covered } from '@shared/domain/compliance/SecMc3Coverage';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { LoanAccount } from '../../domain/LoanAccount';

/**
 * `ADR-053` — resolves whether a `LoanAccount` is covered by BSP Circular 1133 / SEC MC 3's
 * ceilings, by looking up its product's `isUnsecuredGeneralPurpose` classification (the one
 * criterion not already stored on `LoanAccount` itself) and calling `isSecMc3Covered()`.
 *
 * Mirrors the existing precedent of `loan-account`'s application layer reaching into
 * `loan-product`'s port directly (same pattern already used for D-3's range validation in
 * `CreateLoanAccountUseCase`), rather than placing this in `shared/`, which must not depend on any
 * specific module.
 */
export async function resolveSecMc3Coverage(loanAccount: LoanAccount, loanProductRepository: ILoanProductRepository): Promise<boolean> {
  const version = await loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
  if (!version) throw new NotFoundError('LoanProductVersion', loanAccount.loanProductVersionId);

  const product = await loanProductRepository.findById(version.loanProductId);
  if (!product) throw new NotFoundError('LoanProduct', version.loanProductId);

  // Same "date the loan was originated" convention as `LoanDocumentMergeDataResolver`'s
  // amortization opening row: activatedAt (real disbursement) if available, else the staff-entered
  // anticipated date.
  const originationDate = loanAccount.activatedAt ?? loanAccount.anticipatedDisbursementDate ?? loanAccount.firstRepaymentDate;

  return isSecMc3Covered({
    principalAmount: loanAccount.principalAmount,
    installmentCount: loanAccount.installmentCount,
    isUnsecuredGeneralPurpose: product.isUnsecuredGeneralPurpose,
    originationDate,
  });
}
