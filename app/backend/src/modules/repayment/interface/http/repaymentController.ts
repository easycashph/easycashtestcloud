import type { NextFunction, Request, Response } from 'express';
import { assertBranchAccess, resolveBranchScope } from '@shared/http/branchScope';
import type { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import type { ListRepaymentInstallmentsForLoanUseCase } from '../../application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import type { GetRepaymentInstallmentUseCase } from '../../application/use-cases/GetRepaymentInstallmentUseCase';
import { presentRepaymentInstallment } from './presenters/RepaymentInstallmentPresenter';

export interface RepaymentControllerDeps {
  listRepaymentInstallmentsForLoanUseCase: ListRepaymentInstallmentsForLoanUseCase;
  getRepaymentInstallmentUseCase: GetRepaymentInstallmentUseCase;
  /**
   * Milestone 8.1 / H-1: RepaymentInstallment has no `branchId` field of
   * its own (unlike Borrower/LoanAccount/LoanTransaction) — branch access
   * is checked via the parent LoanAccount's branch instead. This is a
   * deliberate cross-module dependency at the interface layer (mirroring
   * the precedent already set by loan-account's application layer
   * reaching into loan-product's port for D-3's range validation), kept
   * here rather than in the repayment application/infrastructure layers
   * so neither needs to change at all for this fix.
   */
  getLoanAccountUseCase: GetLoanAccountUseCase;
}

/**
 * Thin, READ-ONLY controller (D-2, approved): no write endpoint is exposed
 * for CreateRepaymentInstallmentUseCase or RecordInstallmentPaymentUseCase
 * — both remain internal application primitives until the calculation
 * engine and payment allocation algorithm exist to be their real callers.
 */
export class RepaymentController {
  constructor(private readonly deps: RepaymentControllerDeps) {}

  listForLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccountId = req.params.loanAccountId as string;
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(loanAccountId);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: checked via the parent loan account's branch.

      const installments = await this.deps.listRepaymentInstallmentsForLoanUseCase.execute(loanAccountId);
      // ADR-050 / CALCULATION_ENGINE_SPEC.md §12: live penalty is computed only for a prospective
      // (non-migrated) loan — !legacyId — never for a migrated loan's already-snapshotted figures.
      const penaltyContext = { isProspectiveLoan: !loanAccount.legacyId, principalAmount: loanAccount.principalAmount };
      // Genuinely unpaginated by design (ADR-042 §7/§11: a schedule is
      // bounded, low-hundreds-per-loan at most) — nextCursor is always
      // null here, kept only for response-shape consistency with every
      // other list endpoint.
      res.status(200).json({
        items: installments.map((installment) => presentRepaymentInstallment(installment, penaltyContext)),
        nextCursor: null,
      });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const installment = await this.deps.getRepaymentInstallmentUseCase.execute(req.params.id as string);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(installment.loanAccountId);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: checked via the parent loan account's branch.
      const penaltyContext = { isProspectiveLoan: !loanAccount.legacyId, principalAmount: loanAccount.principalAmount };
      res.status(200).json(presentRepaymentInstallment(installment, penaltyContext));
    } catch (error) {
      next(error);
    }
  };
}
