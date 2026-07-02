import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import type { CreateLoanAccountUseCase } from '../../application/use-cases/CreateLoanAccountUseCase';
import type { GetLoanAccountUseCase } from '../../application/use-cases/GetLoanAccountUseCase';
import type { ListLoanAccountsUseCase } from '../../application/use-cases/ListLoanAccountsUseCase';
import type { ApproveLoanUseCase } from '../../application/use-cases/ApproveLoanUseCase';
import type { RejectLoanUseCase } from '../../application/use-cases/RejectLoanUseCase';
import type { CreateLoanAccountRequestBody, RejectLoanRequestBody } from './loanAccountSchemas';
import { presentLoanAccount } from './presenters/LoanAccountPresenter';

export interface LoanAccountControllerDeps {
  createLoanAccountUseCase: CreateLoanAccountUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
  listLoanAccountsUseCase: ListLoanAccountsUseCase;
  approveLoanUseCase: ApproveLoanUseCase;
  rejectLoanUseCase: RejectLoanUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture), matching AuthController's shape. */
export class LoanAccountController {
  constructor(private readonly deps: LoanAccountControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateLoanAccountRequestBody;
      const loanAccount = await this.deps.createLoanAccountUseCase.execute(body);
      res.status(201).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const loanAccounts = await this.deps.listLoanAccountsUseCase.execute({ limit, cursor });
      res.status(200).json(toPaginatedResponse(loanAccounts.map(presentLoanAccount), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.approveLoanUseCase.execute(req.params.id as string, currentUser.sub);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RejectLoanRequestBody;
      await this.deps.rejectLoanUseCase.execute(req.params.id as string, body.reason);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };
}
