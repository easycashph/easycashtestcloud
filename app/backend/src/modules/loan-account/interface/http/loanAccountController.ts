import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
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
      // Milestone 8.1 / H-1: never trust a client-supplied branchId for a
      // branch-scoped user — their own branch always wins.
      const scope = resolveBranchScope(req);
      const branchId = resolveWriteBranchId(scope, body.branchId);
      const loanAccount = await this.deps.createLoanAccountUseCase.execute({ ...body, branchId });
      res.status(201).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: reject cross-branch reads for non-global roles.
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const loanAccounts = await this.deps.listLoanAccountsUseCase.execute({ limit, cursor, branchId: resolveBranchFilter(scope) });
      res.status(200).json(toPaginatedResponse(loanAccounts.map(presentLoanAccount), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      // H-1: verify branch access BEFORE mutating — a branch-scoped
      // Manager must not be able to approve another branch's loan.
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      await this.deps.approveLoanUseCase.execute(req.params.id as string, currentUser.sub);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const body = req.body as RejectLoanRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as approve() above.
      await this.deps.rejectLoanUseCase.execute(req.params.id as string, body.reason);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };
}
