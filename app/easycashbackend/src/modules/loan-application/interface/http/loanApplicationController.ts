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
import type { StartLoanApplicationReviewUseCase } from '../../application/use-cases/StartLoanApplicationReviewUseCase';
import type { SubmitLoanApplicationReviewReportUseCase } from '../../application/use-cases/SubmitLoanApplicationReviewReportUseCase';
import type { SetMitigationAccountOwnerUseCase } from '../../application/use-cases/SetMitigationAccountOwnerUseCase';
import type { GenerateAiDocumentReviewUseCase } from '../../application/use-cases/GenerateAiDocumentReviewUseCase';
import type { TagLoanApplicationPreApprovalUseCase } from '../../application/use-cases/TagLoanApplicationPreApprovalUseCase';
import type { UpdateLoanApplicationUseCase } from '../../application/use-cases/UpdateLoanApplicationUseCase';
import type { UpdateLoanApplicationIntakeUseCase } from '../../application/use-cases/UpdateLoanApplicationIntakeUseCase';
import type { LoanApplicationPreQualificationService } from '../../application/services/LoanApplicationPreQualificationService';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type {
  AssignLoanApplicationProductRequestBody,
  CreateLoanApplicationRequestBody,
  DecideLoanApplicationRequestBody,
  ReviewReportRequestBody,
  SetMitigationAccountOwnerRequestBody,
  UpdateLoanApplicationRequestBody,
  UpdateLoanApplicationIntakeRequestBody,
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
  startLoanApplicationReviewUseCase: StartLoanApplicationReviewUseCase;
  submitLoanApplicationReviewReportUseCase: SubmitLoanApplicationReviewReportUseCase;
  setMitigationAccountOwnerUseCase: SetMitigationAccountOwnerUseCase;
  generateAiDocumentReviewUseCase: GenerateAiDocumentReviewUseCase;
  tagLoanApplicationPreApprovalUseCase: TagLoanApplicationPreApprovalUseCase;
  updateLoanApplicationUseCase: UpdateLoanApplicationUseCase;
  updateLoanApplicationIntakeUseCase: UpdateLoanApplicationIntakeUseCase;
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

  /** A client's Borrower comes from one of two directions (see schema.prisma's LoanApplication
   * doc comments): the original walk-in flow converts an APPROVED application INTO a brand-new
   * Borrower (`Borrower.sourceApplicationId`, reverse-looked-up here), while the "Create Loan
   * Application" renewal flow (2026-07-14) is created FROM an already-existing Borrower
   * (`application.borrowerId`, set directly at creation). Both must resolve to the same linkage
   * shape so "Loan Account Created" detection works for either kind of application.
   *
   * 2026-07-16: the loan account itself is looked up by `LoanAccount.sourceApplicationId` (the
   * exact application it was created FROM), not "this borrower's most recent/first loan
   * account" — the old heuristic falsely showed an older, unrelated loan account (e.g. a prior
   * closed loan) as "the account THIS application produced" for any borrower who already had one
   * on file, which is exactly what happens on every renewal. */
  private async buildLinkage(application: LoanApplication): Promise<LoanApplicationLinkage> {
    const borrower =
      (await this.deps.borrowerRepository.findBySourceApplicationId(application.id)) ??
      (application.borrowerId ? await this.deps.borrowerRepository.findById(application.borrowerId) : null);
    const loanAccount = await this.deps.loanAccountRepository.findBySourceApplicationId(application.id);
    return {
      createdBorrowerId: borrower?.id ?? null,
      createdLoanAccountId: loanAccount?.id ?? null,
      createdLoanAccountCode: loanAccount?.loanCode ?? null,
    };
  }

  private async present(application: LoanApplication): Promise<ReturnType<typeof presentLoanApplication>> {
    const linkage = await this.buildLinkage(application);
    return presentLoanApplication(application, this.buildBreakdown(application), linkage);
  }

  /** Batched variant of `present` for list views - one borrower query and one loan-account
   * query for the whole page instead of N+1 (see `buildLinkage`'s doc comment for the two
   * directions a Borrower can be resolved from). */
  private async presentMany(applications: LoanApplication[]): Promise<ReturnType<typeof presentLoanApplication>[]> {
    const convertedBorrowers = await this.deps.borrowerRepository.findManyBySourceApplicationIds(applications.map((a) => a.id));
    const borrowerByApplicationId = new Map(convertedBorrowers.map((b) => [b.sourceApplicationId as string, b]));

    const directBorrowerIds = [...new Set(applications.map((a) => a.borrowerId).filter((id): id is string => Boolean(id)))];
    const directBorrowers = await Promise.all(directBorrowerIds.map((id) => this.deps.borrowerRepository.findById(id)));
    const directBorrowerById = new Map(directBorrowers.filter((b) => b !== null).map((b) => [b!.id, b!]));

    for (const application of applications) {
      if (!borrowerByApplicationId.has(application.id) && application.borrowerId) {
        const borrower = directBorrowerById.get(application.borrowerId);
        if (borrower) borrowerByApplicationId.set(application.id, borrower);
      }
    }

    // 2026-07-16: looked up by LoanAccount.sourceApplicationId (the exact application it was
    // created FROM) — see `buildLinkage`'s doc comment for why a borrower-keyed lookup was wrong.
    const loanAccounts = await this.deps.loanAccountRepository.findManyBySourceApplicationIds(applications.map((a) => a.id));
    const loanAccountByApplicationId = new Map(loanAccounts.map((la) => [la.sourceApplicationId as string, la]));

    return applications.map((application) => {
      const borrower = borrowerByApplicationId.get(application.id);
      const loanAccount = loanAccountByApplicationId.get(application.id);
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
      const status = typeof req.query.status === 'string' ? (req.query.status as LoanApplication['status']) : undefined;
      const requestedCategory = typeof req.query.requestedCategory === 'string' ? req.query.requestedCategory : undefined;
      const applications = await this.deps.listLoanApplicationsUseCase.execute({
        limit,
        cursor,
        branchId: resolveBranchFilter(scope),
        search,
        status,
        requestedCategory,
      });
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

  startReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.startLoanApplicationReviewUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  submitReviewReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ReviewReportRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.submitLoanApplicationReviewReportUseCase.execute(req.params.id as string, currentUser.sub, body);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  /** 2026-07-29 - see `SetMitigationAccountOwnerUseCase`'s doc comment: unlike `submitReviewReport`
   * above, callable regardless of the application's status. */
  setMitigationAccountOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountOwner } = req.body as SetMitigationAccountOwnerRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.setMitigationAccountOwnerUseCase.execute(req.params.id as string, currentUser.sub, accountOwner);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  /** Mocked (2026-07-22) — see `AiDocumentReviewResult`'s doc comment. Read-only, nothing is
   * persisted here; the officer decides whether to insert the draft into CRM recommendation. */
  aiDocumentReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deps.generateAiDocumentReviewUseCase.execute(req.params.id as string);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  tagPreApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.tagLoanApplicationPreApprovalUseCase.execute(req.params.id as string, currentUser.sub);
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

  /** 2026-08-12 (user request/bug fix) - full intake-field PATCH for LMS staff (MIS/Loan Operation
   * Manager/CRM), covering everything `update` above deliberately doesn't (see
   * UpdateLoanApplicationIntakeUseCase's doc comment). */
  updateIntake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanApplicationUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const body = req.body as UpdateLoanApplicationIntakeRequestBody;
      const application = await this.deps.updateLoanApplicationIntakeUseCase.execute(req.params.id as string, body);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };
}
