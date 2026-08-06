import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateBorrowerUseCase } from '../../application/use-cases/CreateBorrowerUseCase';
import type { GetBorrowerUseCase } from '../../application/use-cases/GetBorrowerUseCase';
import type { ListBorrowersUseCase } from '../../application/use-cases/ListBorrowersUseCase';
import type { UpdateBorrowerUseCase } from '../../application/use-cases/UpdateBorrowerUseCase';
import type { CreateCoBorrowerUseCase } from '../../application/use-cases/CreateCoBorrowerUseCase';
import type { GetCoBorrowerUseCase } from '../../application/use-cases/GetCoBorrowerUseCase';
import type { ListCoBorrowersUseCase } from '../../application/use-cases/ListCoBorrowersUseCase';
import type { UpdateCoBorrowerUseCase } from '../../application/use-cases/UpdateCoBorrowerUseCase';
import type { GetBorrowerRiskSummaryUseCase } from '../../application/use-cases/GetBorrowerRiskSummaryUseCase';
import type { GetBorrowerPortalAccountStatusUseCase } from '@modules/client-portal/application/use-cases/GetBorrowerPortalAccountStatusUseCase';
import type { CreatePortalAccountForBorrowerUseCase } from '@modules/client-portal/application/use-cases/CreatePortalAccountForBorrowerUseCase';
import type { BindPortalAccountToBorrowerUseCase } from '@modules/client-portal/application/use-cases/BindPortalAccountToBorrowerUseCase';
import type {
  CreateBorrowerRequestBody,
  CreateCoBorrowerRequestBody,
  UpdateBorrowerRequestBody,
  UpdateCoBorrowerRequestBody,
} from './borrowerSchemas';
import { presentBorrower, presentCoBorrower } from './presenters/BorrowerPresenter';

export interface BorrowerControllerDeps {
  createBorrowerUseCase: CreateBorrowerUseCase;
  getBorrowerUseCase: GetBorrowerUseCase;
  listBorrowersUseCase: ListBorrowersUseCase;
  updateBorrowerUseCase: UpdateBorrowerUseCase;
  createCoBorrowerUseCase: CreateCoBorrowerUseCase;
  getCoBorrowerUseCase: GetCoBorrowerUseCase;
  listCoBorrowersUseCase: ListCoBorrowersUseCase;
  updateCoBorrowerUseCase: UpdateCoBorrowerUseCase;
  getBorrowerRiskSummaryUseCase: GetBorrowerRiskSummaryUseCase;
  /** Bind existing Client data to Portal (2026-08-06, MIS-only, Client Profile page). */
  getBorrowerPortalAccountStatusUseCase: GetBorrowerPortalAccountStatusUseCase;
  createPortalAccountForBorrowerUseCase: CreatePortalAccountForBorrowerUseCase;
  bindPortalAccountToBorrowerUseCase: BindPortalAccountToBorrowerUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture), matching AuthController's shape. */
export class BorrowerController {
  constructor(private readonly deps: BorrowerControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateBorrowerRequestBody;
      // Milestone 8.1 / H-1: never trust a client-supplied branchId for a
      // branch-scoped user — their own branch always wins. A global user's
      // requested branchId is trusted as-is.
      const scope = resolveBranchScope(req);
      const branchId = resolveWriteBranchId(scope, body.branchId);
      const currentUser = getCurrentUser(req);
      const borrower = await this.deps.createBorrowerUseCase.execute({ ...body, branchId }, currentUser.sub);
      res.status(201).json(presentBorrower(borrower));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const borrower = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, borrower.branchId); // H-1: reject cross-branch reads for non-global roles.
      res.status(200).json(presentBorrower(borrower));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const search = parseSearchParam(req.query);
      const loanPresence =
        req.query.loanPresence === 'WITH_ACTIVE' || req.query.loanPresence === 'WITH_HISTORY' || req.query.loanPresence === 'NONE'
          ? req.query.loanPresence
          : undefined;
      const borrowers = await this.deps.listBorrowersUseCase.execute({
        limit,
        cursor,
        branchId: resolveBranchFilter(scope),
        search,
        loanPresence,
      });
      res.status(200).json(toPaginatedResponse(borrowers.map(presentBorrower), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: reject cross-branch writes for non-global roles.
      const body = req.body as UpdateBorrowerRequestBody;
      const borrower = await this.deps.updateBorrowerUseCase.execute(req.params.id as string, body, req.authUser?.sub);
      res.status(200).json(presentBorrower(borrower));
    } catch (error) {
      next(error);
    }
  };

  createCoBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateCoBorrowerRequestBody;
      const currentUser = getCurrentUser(req);
      const coBorrower = await this.deps.createCoBorrowerUseCase.execute(body, currentUser.sub);
      res.status(201).json(presentCoBorrower(coBorrower));
    } catch (error) {
      next(error);
    }
  };

  getCoBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coBorrower = await this.deps.getCoBorrowerUseCase.execute(req.params.id as string);
      res.status(200).json(presentCoBorrower(coBorrower));
    } catch (error) {
      next(error);
    }
  };

  listCoBorrowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.deps.listCoBorrowersUseCase.execute(req.params.id as string);
      res.status(200).json({ items: items.map(presentCoBorrower) });
    } catch (error) {
      next(error);
    }
  };

  updateCoBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateCoBorrowerRequestBody;
      const coBorrower = await this.deps.updateCoBorrowerUseCase.execute(req.params.id as string, body, req.authUser?.sub);
      res.status(200).json(presentCoBorrower(coBorrower));
    } catch (error) {
      next(error);
    }
  };

  riskSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const summary = await this.deps.getBorrowerRiskSummaryUseCase.execute(req.params.id as string);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  };

  getPortalAccountStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const status = await this.deps.getBorrowerPortalAccountStatusUseCase.execute(req.params.id as string);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  };

  createPortalAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const currentUser = getCurrentUser(req);
      const result = await this.deps.createPortalAccountForBorrowerUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  bindPortalAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const currentUser = getCurrentUser(req);
      const result = await this.deps.bindPortalAccountToBorrowerUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(200).json({ id: result.id, email: result.email, status: result.status, mustChangePassword: result.mustChangePassword });
    } catch (error) {
      next(error);
    }
  };
}
