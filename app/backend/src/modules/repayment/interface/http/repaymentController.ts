import type { NextFunction, Request, Response } from 'express';
import { assertBranchAccess, resolveBranchScope } from '@shared/http/branchScope';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { Money } from '@shared/domain/Money';
import type { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import { resolveSecMc3Coverage } from '@modules/loan-account/application/services/SecMc3CoverageResolver';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { ListRepaymentInstallmentsForLoanUseCase } from '../../application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import type { GetRepaymentInstallmentUseCase } from '../../application/use-cases/GetRepaymentInstallmentUseCase';
import type { ReducePenaltyUseCase } from '../../application/use-cases/ReducePenaltyUseCase';
import type { AdjustFeesUseCase } from '../../application/use-cases/AdjustFeesUseCase';
import type { ListInstallmentAdjustmentsForLoanUseCase } from '../../application/use-cases/ListInstallmentAdjustmentsForLoanUseCase';
import type { RepaymentInstallment } from '../../domain/RepaymentInstallment';
import { presentRepaymentInstallment } from './presenters/RepaymentInstallmentPresenter';
import { presentInstallmentAdjustment } from './presenters/InstallmentAdjustmentPresenter';
import type { AdjustFeesRequestBody, ReducePenaltyRequestBody } from './repaymentSchemas';

/** 2026-07-24 (user-confirmed): the loan's maturity date - the latest `dueDate` across its whole
 * schedule - same definition as the "Matured" badge/dashboard overlay elsewhere in this codebase.
 * Feeds `PenaltyComputationContext.maturityDate`, which caps live penalty accrual at this date. */
function resolveMaturityDate(installments: RepaymentInstallment[]): Date {
  return installments.reduce((latest, i) => (i.dueDate > latest ? i.dueDate : latest), installments[0]?.dueDate ?? new Date(0));
}

export interface RepaymentControllerDeps {
  listRepaymentInstallmentsForLoanUseCase: ListRepaymentInstallmentsForLoanUseCase;
  getRepaymentInstallmentUseCase: GetRepaymentInstallmentUseCase;
  reducePenaltyUseCase: ReducePenaltyUseCase;
  adjustFeesUseCase: AdjustFeesUseCase;
  listInstallmentAdjustmentsForLoanUseCase: ListInstallmentAdjustmentsForLoanUseCase;
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
  /** ADR-053: only needed to resolve `PenaltyComputationContext.isSecMc3Covered` (the product's `isUnsecuredGeneralPurpose` classification isn't stored on LoanAccount itself). */
  loanProductRepository: ILoanProductRepository;
}

/**
 * Mostly read-only (D-2) — `CreateRepaymentInstallmentUseCase`/`RecordInstallmentPaymentUseCase`
 * remain internal-only application primitives. `reducePenalty` below is a deliberate, narrow
 * exception (2026-07-15, Reduce Penalty feature, user-confirmed), matching the same "D-2 holds
 * until a real feature needs a write" precedent already set by the ledger module's payment/reverse
 * endpoints.
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
      const penaltyContext = {
        isProspectiveLoan: !loanAccount.legacyId,
        principalAmount: loanAccount.principalAmount,
        isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
        maturityDate: resolveMaturityDate(installments),
      };
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
      const penaltyContext = {
        isProspectiveLoan: !loanAccount.legacyId,
        principalAmount: loanAccount.principalAmount,
        isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
        maturityDate: resolveMaturityDate(await this.deps.listRepaymentInstallmentsForLoanUseCase.execute(loanAccount.id)),
      };
      res.status(200).json(presentRepaymentInstallment(installment, penaltyContext));
    } catch (error) {
      next(error);
    }
  };

  reducePenalty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const installmentId = req.params.id as string;
      const installment = await this.deps.getRepaymentInstallmentUseCase.execute(installmentId);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(installment.loanAccountId);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: same pattern as get()/listForLoan() above.

      const body = req.body as ReducePenaltyRequestBody;
      const currentUser = getCurrentUser(req);
      await this.deps.reducePenaltyUseCase.execute(installmentId, Money.of(body.newAmount), body.reason, currentUser.sub);

      const updated = await this.deps.getRepaymentInstallmentUseCase.execute(installmentId);
      const penaltyContext = {
        isProspectiveLoan: !loanAccount.legacyId,
        principalAmount: loanAccount.principalAmount,
        isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
        maturityDate: resolveMaturityDate(await this.deps.listRepaymentInstallmentsForLoanUseCase.execute(loanAccount.id)),
      };
      res.status(200).json(presentRepaymentInstallment(updated, penaltyContext));
    } catch (error) {
      next(error);
    }
  };

  adjustFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const installmentId = req.params.id as string;
      const installment = await this.deps.getRepaymentInstallmentUseCase.execute(installmentId);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(installment.loanAccountId);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: same pattern as get()/listForLoan() above.

      const body = req.body as AdjustFeesRequestBody;
      const currentUser = getCurrentUser(req);
      await this.deps.adjustFeesUseCase.execute(installmentId, Money.of(body.newAmount), body.reason, currentUser.sub);

      const updated = await this.deps.getRepaymentInstallmentUseCase.execute(installmentId);
      const penaltyContext = {
        isProspectiveLoan: !loanAccount.legacyId,
        principalAmount: loanAccount.principalAmount,
        isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
        maturityDate: resolveMaturityDate(await this.deps.listRepaymentInstallmentsForLoanUseCase.execute(loanAccount.id)),
      };
      res.status(200).json(presentRepaymentInstallment(updated, penaltyContext));
    } catch (error) {
      next(error);
    }
  };

  listInstallmentAdjustmentsForLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccountId = req.params.loanAccountId as string;
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(loanAccountId);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: same pattern as listForLoan() above.

      const adjustments = await this.deps.listInstallmentAdjustmentsForLoanUseCase.execute(loanAccountId);
      // Unpaginated, same rationale as listForLoan() — bounded by the loan's own schedule size.
      res.status(200).json({ items: adjustments.map(presentInstallmentAdjustment), nextCursor: null });
    } catch (error) {
      next(error);
    }
  };
}
