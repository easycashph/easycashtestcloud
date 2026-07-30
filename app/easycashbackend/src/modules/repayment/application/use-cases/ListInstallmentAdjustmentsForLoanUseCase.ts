import type { IPenaltyReductionRepository, PenaltyReductionView } from '../ports/IPenaltyReductionRepository';
import type { IFeeAdjustmentRepository, FeeAdjustmentView } from '../ports/IFeeAdjustmentRepository';

export interface ListInstallmentAdjustmentsForLoanUseCaseDeps {
  penaltyReductionRepository: IPenaltyReductionRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
}

export type InstallmentAdjustment =
  | { kind: 'PENALTY_REDUCTION'; view: PenaltyReductionView }
  | { kind: 'FEE_ADJUSTMENT'; view: FeeAdjustmentView };

/**
 * 2026-07-16 (unified Payment History timeline, user request): merges the two adjustment audit
 * trails (`PenaltyReduction`/`FeeAdjustment`) into one chronological list, newest first — so the
 * Loan Detail page's Payment History tab can interleave them with real `LoanTransaction` rows
 * instead of only ever showing the latest override annotation on the Repayment Schedule table
 * (which silently drops history on a second reduction/adjustment of the same installment).
 *
 * Deliberately NOT surfaced as `LoanTransaction` rows — these have no ledger/balance impact (no
 * money moved), so folding them into that table would misrepresent them as financial transactions.
 * This is a read-only merge at the presentation layer, not a schema/ledger change.
 */
export class ListInstallmentAdjustmentsForLoanUseCase {
  constructor(private readonly deps: ListInstallmentAdjustmentsForLoanUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<InstallmentAdjustment[]> {
    const [penaltyReductions, feeAdjustments] = await Promise.all([
      this.deps.penaltyReductionRepository.findViewsByLoanAccountId(loanAccountId),
      this.deps.feeAdjustmentRepository.findViewsByLoanAccountId(loanAccountId),
    ]);

    const merged: InstallmentAdjustment[] = [
      ...penaltyReductions.map((view): InstallmentAdjustment => ({ kind: 'PENALTY_REDUCTION', view })),
      ...feeAdjustments.map((view): InstallmentAdjustment => ({ kind: 'FEE_ADJUSTMENT', view })),
    ];

    return merged.sort((a, b) => b.view.createdAt.getTime() - a.view.createdAt.getTime());
  }
}
