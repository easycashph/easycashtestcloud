import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { CreateLoanApplicationUseCase } from '../../application/use-cases/CreateLoanApplicationUseCase';
import type { GetLoanApplicationUseCase } from '../../application/use-cases/GetLoanApplicationUseCase';
import type { ListLoanApplicationsUseCase } from '../../application/use-cases/ListLoanApplicationsUseCase';
import type { AssignLoanApplicationProductUseCase } from '../../application/use-cases/AssignLoanApplicationProductUseCase';
import type { ApproveLoanApplicationUseCase } from '../../application/use-cases/ApproveLoanApplicationUseCase';
import type { DeclineLoanApplicationUseCase } from '../../application/use-cases/DeclineLoanApplicationUseCase';
import type { RevertLoanApplicationDecisionUseCase } from '../../application/use-cases/RevertLoanApplicationDecisionUseCase';
import type { UpdateLoanApplicationUseCase } from '../../application/use-cases/UpdateLoanApplicationUseCase';
import type { LoanApplicationPreQualificationService } from '../../application/services/LoanApplicationPreQualificationService';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type {
  AssignLoanApplicationProductRequestBody,
  CreateLoanApplicationRequestBody,
  DecideLoanApplicationRequestBody,
  UpdateLoanApplicationRequestBody,
} from './loanApplicationSchemas';
import { presentLoanApplication, type LoanApplicationLinkage } from './presenters/LoanApplicationPresenter';

export interface LoanApplicationControllerDeps {
  createLoanApplicationUseCase: CreateLoanApplicationUseCase;
  getLoanApplicationUseCase: GetLoanApplicationUseCase;
  listLoanApplicationsUseCase: ListLoanApplicationsUseCase;
  assignLoanApplicationProductUseCase: AssignLoanApplicationProductUseCase;
  approveLoanApplicationUseCase: ApproveLoanApplicationUseCase;
  declineLoanApplicationUseCase: DeclineLoanApplicationUseCase;
  revertLoanApplicationDecisionUseCase: RevertLoanApplicationDecisionUseCase;
  updateLoanApplicationUseCase: UpdateLoanApplicationUseCase;
  preQualificationService: LoanApplicationPreQualificationService;
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class LoanApplicationController {
  constructor(private readonly deps: LoanApplicationControllerDeps) {}

  /** Re-derives the "why" breakdown behind the application's current PREAPPROVED/PREDECLINED
   * verdict, purely from already-known fields — reuses the cached `distanceFromBranchKm` rather
   * than re-geocoding, so this is a cheap, no-I/O call safe to make on every read. */
  private buildBreakdown(application: LoanApplication) {
    const p = application.toProps();
    return this.deps.preQualificationService.evaluateCriteria({
      age: p.age,
      monthlyIncome: p.monthlyIncome,
      requestedAmount: p.requestedAmount,
      requestedTermMonths: p.requestedTermMonths,
      requestedCategory: p.requestedCategory,
      distanceFromBranchKm: p.distanceFromBranchKm ?? null,
    });
  }

  private async buildLinkage(applicationId: string): Promise<LoanApplicationLinkage> {
    const borrower = await this.deps.borrowerRepository.findBySourceApplicationId(applicationId);
    if (!borrower) {
      return { createdBorrowerId: null, createdLoanAccountId: null, createdLoanAccountCode: null };
    }
    const [loanAccount] = await this.deps.loanAccountRepository.findMany({ borrowerId: borrower.id, limit: 1 });
    return {
      createdBorrowerId: borrower.id,
      createdLoanAccountId: loanAccount?.id ?? null,
      createdLoanAccountCode: loanAccount?.loanCode ?? null,
    };
  }

  private async present(application: LoanApplication): Promise<ReturnType<typeof presentLoanApplication>> {
    const linkage = await this.buildLinkage(application.id);
    return presentLoanApplication(application, this.buildBreakdown(application), linkage);
  }

  /** Batched variant of `present` for list views - one borrower query and one loan-account
   * query for the whole page instead of N+1. */
  private async presentMany(applications: LoanApplication[]): Promise<ReturnType<typeof presentLoanApplication>[]> {
    const borrowers = await this.deps.borrowerRepository.findManyBySourceApplicationIds(applications.map((a) => a.id));
    const borrowerByApplicationId = new Map(borrowers.map((b) => [b.sourceApplicationId as string, b]));
    const borrowerIds = borrowers.map((b) => b.id);
    const loanAccounts =
      borrowerIds.length > 0
        ? (await Promise.all(borrowerIds.map((borrowerId) => this.deps.loanAccountRepository.findMany({ borrowerId, limit: 1 })))).flat()
        : [];
    const loanAccountByBorrowerId = new Map(loanAccounts.map((la) => [la.borrowerId, la]));

    return applications.map((application) => {
      const borrower = borrowerByApplicationId.get(application.id);
      const loanAccount = borrower ? loanAccountByBorrowerId.get(borrower.id) : undefined;
      const linkage: LoanApplicationLinkage = {
        createdBorrowerId: borrower?.id ?? null,
        createdLoanAccountId: loanAccount?.id ?? null,
        createdLoanAccountCode: loanAccount?.loanCode ?? null,
      };
      return presentLoanApplication(application, this.buildBreakdown(application), linkage);
    });
  }

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
      res.status(201).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const application = await this.deps.getLoanApplicationUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, application.branchId);
      res.status(200).json(await this.present(application));
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
      const presented = await this.presentMany(applications);
      res.status(200).json(toPaginatedResponse(presented, limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  assignProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as AssignLoanApplicationProductRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.assignLoanApplicationProductUseCase.execute(
        req.params.id as string,
        body.loanProductVersionId,
        currentUser.sub,
      );
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as DecideLoanApplicationRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.approveLoanApplicationUseCase.execute(req.params.id as string, currentUser.sub, body.decisionNote);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as DecideLoanApplicationRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.declineLoanApplicationUseCase.execute(req.params.id as string, currentUser.sub, body.decisionNote);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  revert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.revertLoanApplicationDecisionUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanApplicationUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const body = req.body as UpdateLoanApplicationRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.updateLoanApplicationUseCase.execute(req.params.id as string, body, currentUser.sub);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };
}
