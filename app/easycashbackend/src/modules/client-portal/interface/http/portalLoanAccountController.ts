import type { NextFunction, Request, Response } from 'express';
import type { ListPortalLoanAccountsUseCase } from '../../application/use-cases/ListPortalLoanAccountsUseCase';
import type { ListPortalLoanAccountInstallmentsUseCase } from '../../application/use-cases/ListPortalLoanAccountInstallmentsUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';

export interface PortalLoanAccountControllerDeps {
  listPortalLoanAccountsUseCase: ListPortalLoanAccountsUseCase;
  listPortalLoanAccountInstallmentsUseCase: ListPortalLoanAccountInstallmentsUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors every other portal controller's shape. */
export class PortalLoanAccountController {
  constructor(private readonly deps: PortalLoanAccountControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const loanAccounts = await this.deps.listPortalLoanAccountsUseCase.execute(account.sub);
      res.status(200).json(loanAccounts);
    } catch (error) {
      next(error);
    }
  };

  listInstallments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const installments = await this.deps.listPortalLoanAccountInstallmentsUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(installments);
    } catch (error) {
      next(error);
    }
  };
}
