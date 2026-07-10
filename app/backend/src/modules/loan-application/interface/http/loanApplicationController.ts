import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateLoanApplicationUseCase } from '../../application/use-cases/CreateLoanApplicationUseCase';
import type { GetLoanApplicationUseCase } from '../../application/use-cases/GetLoanApplicationUseCase';
import type { ListLoanApplicationsUseCase } from '../../application/use-cases/ListLoanApplicationsUseCase';
import type { MarkLoanApplicationReviewedUseCase } from '../../application/use-cases/MarkLoanApplicationReviewedUseCase';
import type { AssignLoanApplicationProductUseCase } from '../../application/use-cases/AssignLoanApplicationProductUseCase';
import type { ApproveLoanApplicationUseCase } from '../../application/use-cases/ApproveLoanApplicationUseCase';
import type { DeclineLoanApplicationUseCase } from '../../application/use-cases/DeclineLoanApplicationUseCase';
import type { RevertLoanApplicationDecisionUseCase } from '../../application/use-cases/RevertLoanApplicationDecisionUseCase';
import type {
  AssignLoanApplicationProductRequestBody,
  CreateLoanApplicationRequestBody,
  DecideLoanApplicationRequestBody,
} from './loanApplicationSchemas';
import { presentLoanApplication } from './presenters/LoanApplicationPresenter';

export interface LoanApplicationControllerDeps {
  createLoanApplicationUseCase: CreateLoanApplicationUseCase;
  getLoanApplicationUseCase: GetLoanApplicationUseCase;
  listLoanApplicationsUseCase: ListLoanApplicationsUseCase;
  markLoanApplicationReviewedUseCase: MarkLoanApplicationReviewedUseCase;
  assignLoanApplicationProductUseCase: AssignLoanApplicationProductUseCase;
  approveLoanApplicationUseCase: ApproveLoanApplicationUseCase;
  declineLoanApplicationUseCase: DeclineLoanApplicationUseCase;
  revertLoanApplicationDecisionUseCase: RevertLoanApplicationDecisionUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class LoanApplicationController {
  constructor(private readonly deps: LoanApplicationControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateLoanApplicationRequestBody;
      const scope = resolveBranchScope(req);
      const branchId = resolveWriteBranchId(scope, body.branchId);
      const currentUser = getCurrentUser(req);
      const application = await this.deps.createLoanApplicationUseCase.execute({
        ...body,
        branchId,
        encodedByUserId: currentUser.sub,
      });
      res.status(201).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const application = await this.deps.getLoanApplicationUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, application.branchId);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const search = parseSearchParam(req.query);
      const applications = await this.deps.listLoanApplicationsUseCase.execute({ limit, cursor, branchId: resolveBranchFilter(scope), search });
      res.status(200).json(toPaginatedResponse(applications.map(presentLoanApplication), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  markReviewed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const application = await this.deps.markLoanApplicationReviewedUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  assignProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as AssignLoanApplicationProductRequestBody;
      const application = await this.deps.assignLoanApplicationProductUseCase.execute(req.params.id as string, body.loanProductVersionId);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as DecideLoanApplicationRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.approveLoanApplicationUseCase.execute(req.params.id as string, currentUser.sub, body.decisionNote);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as DecideLoanApplicationRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.declineLoanApplicationUseCase.execute(req.params.id as string, currentUser.sub, body.decisionNote);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };

  revert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.revertLoanApplicationDecisionUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(200).json(presentLoanApplication(application));
    } catch (error) {
      next(error);
    }
  };
}
