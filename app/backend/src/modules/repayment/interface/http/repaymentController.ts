import type { NextFunction, Request, Response } from 'express';
import type { ListRepaymentInstallmentsForLoanUseCase } from '../../application/use-cases/ListRepaymentInstallmentsForLoanUseCase';
import type { GetRepaymentInstallmentUseCase } from '../../application/use-cases/GetRepaymentInstallmentUseCase';
import { presentRepaymentInstallment } from './presenters/RepaymentInstallmentPresenter';

export interface RepaymentControllerDeps {
  listRepaymentInstallmentsForLoanUseCase: ListRepaymentInstallmentsForLoanUseCase;
  getRepaymentInstallmentUseCase: GetRepaymentInstallmentUseCase;
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
      const installments = await this.deps.listRepaymentInstallmentsForLoanUseCase.execute(req.params.loanAccountId as string);
      // Genuinely unpaginated by design (ADR-042 §7/§11: a schedule is
      // bounded, low-hundreds-per-loan at most) — nextCursor is always
      // null here, kept only for response-shape consistency with every
      // other list endpoint.
      res.status(200).json({ items: installments.map(presentRepaymentInstallment), nextCursor: null });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const installment = await this.deps.getRepaymentInstallmentUseCase.execute(req.params.id as string);
      res.status(200).json(presentRepaymentInstallment(installment));
    } catch (error) {
      next(error);
    }
  };
}
