import { NotFoundError } from '@shared/errors/DomainError';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import { resolveSecMc3Coverage } from '@modules/loan-account/application/services/SecMc3CoverageResolver';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import { AccruedInterestCalculator, type AccruedInterestFigures } from '../services/AccruedInterestCalculator';

export interface GetAccruedInterestUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanProductRepository: ILoanProductRepository;
}

/**
 * 2026-07-24 (user-confirmed) — thin orchestration, same "D-2 read-only" shape as
 * `GetLoanRiskAssessmentUseCase`: loads the loan account and its full schedule, resolves the
 * penalty-computation context (prospective/legacy, SEC MC 3 coverage), and hands both to
 * `AccruedInterestCalculator`.
 *
 * 2026-08-06 (user-confirmed): a migrated (legacy) loan is no longer skipped. Per-installment
 * `resolveComputedPenalty` already falls back to the migrated `due.penalty` snapshot for a
 * non-prospective loan (see that function's own doc comment) rather than the live ADR-050
 * formula, so there was never a technical blocker to computing the interest-accrual figure
 * itself for legacy loans - it only needs the same migrated schedule + `contractualInterestRate`
 * already used everywhere else (e.g. the "Matured" badge). `isProspectiveLoan` is now threaded
 * from the loan's own `legacyId` instead of hardcoded `true`, so the penalty half of the formula
 * keeps using the right basis for each loan type.
 */
export class GetAccruedInterestUseCase {
  constructor(private readonly deps: GetAccruedInterestUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<AccruedInterestFigures | null> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    const isSecMc3Covered = await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository);

    return AccruedInterestCalculator.calculate(
      installments,
      { isProspectiveLoan: !loanAccount.legacyId, principalAmount: loanAccount.principalAmount, isSecMc3Covered },
      loanAccount.contractualInterestRate,
    );
  }
}
