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
 * `AccruedInterestCalculator`. `null` for a migrated (legacy) loan - same "no live projection"
 * scope as `CurrentPenaltyResolver`'s own ADR-050 §5 restriction, since Accrued Interest is built
 * directly on top of that live-computed penalty.
 */
export class GetAccruedInterestUseCase {
  constructor(private readonly deps: GetAccruedInterestUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<AccruedInterestFigures | null> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }
    if (loanAccount.legacyId) {
      return null;
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    const isSecMc3Covered = await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository);

    return AccruedInterestCalculator.calculate(
      installments,
      { isProspectiveLoan: true, principalAmount: loanAccount.principalAmount, isSecMc3Covered },
      loanAccount.contractualInterestRate,
    );
  }
}
