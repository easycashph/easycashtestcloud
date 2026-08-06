import type { NextFunction, Request, Response } from 'express';
import type { ListPortalLoanAccountsUseCase } from '../../application/use-cases/ListPortalLoanAccountsUseCase';
import type { ListPortalLoanAccountInstallmentsUseCase } from '../../application/use-cases/ListPortalLoanAccountInstallmentsUseCase';
import type { GetPortalNextPaymentDueUseCase } from '../../application/use-cases/GetPortalNextPaymentDueUseCase';
import type { ListPortalRecentPaymentsUseCase } from '../../application/use-cases/ListPortalRecentPaymentsUseCase';
import type { ListPortalStatementsOfAccountUseCase } from '../../application/use-cases/ListPortalStatementsOfAccountUseCase';
import type { DownloadPortalStatementOfAccountUseCase } from '../../application/use-cases/DownloadPortalStatementOfAccountUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';

export interface PortalLoanAccountControllerDeps {
  listPortalLoanAccountsUseCase: ListPortalLoanAccountsUseCase;
  listPortalLoanAccountInstallmentsUseCase: ListPortalLoanAccountInstallmentsUseCase;
  getPortalNextPaymentDueUseCase: GetPortalNextPaymentDueUseCase;
  listPortalRecentPaymentsUseCase: ListPortalRecentPaymentsUseCase;
  listPortalStatementsOfAccountUseCase: ListPortalStatementsOfAccountUseCase;
  downloadPortalStatementOfAccountUseCase: DownloadPortalStatementOfAccountUseCase;
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

  nextPaymentDue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const nextPaymentDue = await this.deps.getPortalNextPaymentDueUseCase.execute(account.sub);
      res.status(200).json(nextPaymentDue);
    } catch (error) {
      next(error);
    }
  };

  recentPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const payments = await this.deps.listPortalRecentPaymentsUseCase.execute(account.sub);
      res.status(200).json(payments);
    } catch (error) {
      next(error);
    }
  };

  listStatementsOfAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const statements = await this.deps.listPortalStatementsOfAccountUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(statements);
    } catch (error) {
      next(error);
    }
  };

  downloadStatementOfAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const file = await this.deps.downloadPortalStatementOfAccountUseCase.execute(
        account.sub,
        req.params.id as string,
        req.params.generatedStatementId as string,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.status(200).send(file.buffer);
    } catch (error) {
      next(error);
    }
  };
}
