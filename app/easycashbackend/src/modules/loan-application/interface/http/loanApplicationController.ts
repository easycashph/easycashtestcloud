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
import type { SetMitigationDetailsUseCase } from '../../application/use-cases/SetMitigationDetailsUseCase';
import type { GenerateAiDocumentReviewUseCase } from '../../application/use-cases/GenerateAiDocumentReviewUseCase';
import type { TagLoanApplicationPreApprovalUseCase } from '../../application/use-cases/TagLoanApplicationPreApprovalUseCase';
import type { UndoLoanApplicationPreApprovalUseCase } from '../../application/use-cases/UndoLoanApplicationPreApprovalUseCase';
import type { RevertLoanApplicationToPreApprovalUseCase } from '../../application/use-cases/RevertLoanApplicationToPreApprovalUseCase';
import type { UpdateLoanApplicationUseCase } from '../../application/use-cases/UpdateLoanApplicationUseCase';
import type { UpdateLoanApplicationIntakeUseCase } from '../../application/use-cases/UpdateLoanApplicationIntakeUseCase';
import type { DeleteLoanApplicationUseCase } from '../../application/use-cases/DeleteLoanApplicationUseCase';
import type { GenerateLoanApplicationFormUseCase } from '../../application/use-cases/GenerateLoanApplicationFormUseCase';
import type { GenerateCrmReportUseCase } from '../../application/use-cases/GenerateCrmReportUseCase';
import type { GetLoanApplicationRiskSummaryUseCase } from '../../application/use-cases/GetLoanApplicationRiskSummaryUseCase';
import type { LoanApplicationPreQualificationService } from '../../application/services/LoanApplicationPreQualificationService';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type {
  AssignLoanApplicationProductRequestBody,
  CreateLoanApplicationRequestBody,
  DecideLoanApplicationRequestBody,
  ReviewReportRequestBody,
  SetMitigationAccountOwnerRequestBody,
  SetMitigationDetailsRequestBody,
  UpdateLoanApplicationRequestBody,
  UpdateLoanApplicationIntakeRequestBody,
} from './loanApplicationSchemas';
import { writeTabularXlsx, type TabularColumn } from '@shared/infrastructure/writeTabularXlsx';
import { presentLoanApplication, type LoanApplicationLinkage } from './presenters/LoanApplicationPresenter';

/** 2026-09-12 (Download Excel, user request): mirrors `STATUS_DISPLAY_LABEL` in the frontend's
 * `loanApplicationStatusLabels.ts` - PREAPPROVED/PREDECLINED read as the company's actual
 * terminology ("Requirement Compliance"/"Pre Declined") everywhere a status is shown to staff, the
 * .xlsx export included. Duplicated rather than shared across the frontend/backend boundary (no
 * shared package between them in this codebase) - keep the two in sync if either changes. */
const STATUS_DISPLAY_LABEL: Record<LoanApplication['status'], string> = {
  INCOMPLETE: 'Incomplete',
  PREAPPROVED: 'Requirement Compliance',
  PREDECLINED: 'Pre Declined',
  UNDER_REVIEW: 'Under Review',
  PRE_APPROVAL: 'Pre Approval',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};

/** 2026-09-12: same "why" logic as the frontend list's own `declineReason` (LoanApplicationsPage.tsx)
 * - DECLINED is a human decision (whatever the reviewer typed into decisionNote); PREDECLINED is
 * purely system-computed (LoanApplicationPreQualificationService, advisory only), so its reason is
 * built from whichever check(s) failed instead. Every other status has no "reason" concept. */
function declineReason(app: ReturnType<typeof presentLoanApplication>): string | null {
  if (app.status === 'DECLINED') {
    return app.decisionNote?.trim() || null;
  }
  if (app.status === 'PREDECLINED' && app.preQualificationBreakdown) {
    const checks = app.preQualificationBreakdown.checks;
    const failed = [checks.age, checks.income, checks.employment].filter((c) => c && !c.passed);
    if (failed.length === 0) return null;
    return failed.map((c) => c.detail || c.label).join('; ');
  }
  return null;
}

interface LoanApplicationXlsxRow {
  applicant: string;
  category: string;
  amount: number;
  dtiPercent: number | null;
  riskTier: string;
  status: string;
  reason: string | null;
  loanAccount: string;
  submitted: Date;
}

const LOAN_APPLICATION_XLSX_COLUMNS: TabularColumn<LoanApplicationXlsxRow>[] = [
  { header: 'Applicant', key: 'applicant', width: 28 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Amount', key: 'amount', width: 14, numFmt: '#,##0.00', isMoney: true },
  { header: 'DTI %', key: 'dtiPercent', width: 10, numFmt: '0.0"%"' },
  { header: 'Risk', key: 'riskTier', width: 10 },
  { header: 'Decision Status', key: 'status', width: 20 },
  { header: 'Reason', key: 'reason', width: 40 },
  { header: 'Loan Account', key: 'loanAccount', width: 16 },
  { header: 'Submitted', key: 'submitted', width: 14, numFmt: 'mm/dd/yyyy' },
];

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
  setMitigationDetailsUseCase: SetMitigationDetailsUseCase;
  generateAiDocumentReviewUseCase: GenerateAiDocumentReviewUseCase;
  tagLoanApplicationPreApprovalUseCase: TagLoanApplicationPreApprovalUseCase;
  undoLoanApplicationPreApprovalUseCase: UndoLoanApplicationPreApprovalUseCase;
  revertLoanApplicationToPreApprovalUseCase: RevertLoanApplicationToPreApprovalUseCase;
  updateLoanApplicationUseCase: UpdateLoanApplicationUseCase;
  updateLoanApplicationIntakeUseCase: UpdateLoanApplicationIntakeUseCase;
  deleteLoanApplicationUseCase: DeleteLoanApplicationUseCase;
  generateLoanApplicationFormUseCase: GenerateLoanApplicationFormUseCase;
  generateCrmReportUseCase: GenerateCrmReportUseCase;
  getLoanApplicationRiskSummaryUseCase: GetLoanApplicationRiskSummaryUseCase;
  preQualificationService: LoanApplicationPreQualificationService;
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class LoanApplicationController {
  constructor(private readonly deps: LoanApplicationControllerDeps) {}

  /** Re-derives the "why" breakdown behind the application's current PREAPPROVED/PREDECLINED
   * verdict, purely from already-known fields — no I/O, so this is cheap and safe to call on every
   * read. Since this recomputes fresh every time, every application (old or new) shows the current
   * `checks.employment` shape immediately, not just ones edited after 2026-09-09's check swap. */
  private buildBreakdown(application: LoanApplication) {
    const p = application.toProps();
    return this.deps.preQualificationService.evaluateCriteria({
      age: p.age,
      monthlyIncome: p.monthlyIncome,
      requestedAmount: p.requestedAmount,
      requestedTermMonths: p.requestedTermMonths,
      requestedCategory: p.requestedCategory,
      occupation: p.occupation,
      employer: p.employer,
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

  /** 2026-09-12 (user request): counts for the list's risk-summary tiles - branch-scoped only,
   * not affected by the list's own search/status/category/date filters (see the use case's own
   * doc comment for why). */
  riskSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const counts = await this.deps.getLoanApplicationRiskSummaryUseCase.execute(resolveBranchFilter(scope));
      res.status(200).json(counts);
    } catch (error) {
      next(error);
    }
  };

  /** Shared by `list` and `listXlsx` - the same search/status/category/risk/date-range filters,
   * parsed once so the .xlsx export can never silently drift from what the on-screen list actually
   * filters on. */
  private parseListFilters(req: Request) {
    const search = parseSearchParam(req.query);
    const status = typeof req.query.status === 'string' ? (req.query.status as LoanApplication['status']) : undefined;
    const requestedCategory = typeof req.query.requestedCategory === 'string' ? req.query.requestedCategory : undefined;
    const riskTier =
      typeof req.query.riskTier === 'string' && ['LOW', 'MEDIUM', 'HIGH'].includes(req.query.riskTier)
        ? (req.query.riskTier as 'LOW' | 'MEDIUM' | 'HIGH')
        : undefined;
    // 2026-09-11 (user request): "Submitted" date-range filter on the Loan Applications list -
    // createdBefore is treated as end-of-day so picking the same date for both ends still
    // includes every application submitted that day, not just ones at/before midnight.
    const createdAfter = typeof req.query.createdAfter === 'string' ? new Date(req.query.createdAfter) : undefined;
    const createdBeforeRaw = typeof req.query.createdBefore === 'string' ? new Date(req.query.createdBefore) : undefined;
    const createdBefore = createdBeforeRaw ? new Date(createdBeforeRaw.setHours(23, 59, 59, 999)) : undefined;
    return { search, status, requestedCategory, riskTier, createdAfter, createdBefore };
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const applications = await this.deps.listLoanApplicationsUseCase.execute({
        limit,
        cursor,
        branchId: resolveBranchFilter(scope),
        ...this.parseListFilters(req),
      });
      const presented = await this.presentMany(applications);
      res.status(200).json(toPaginatedResponse(presented, limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  /** 2026-09-12 (user request): "Download Excel" on the Loan Applications list - same
   * search/status/category/risk/date filters currently applied on screen (via `parseListFilters`),
   * not paginated (a real export needs every matching row, not one page) - same posture as
   * `reports/loan-releases.xlsx` and friends. `EXPORT_LIMIT` is a generous ceiling, not a real
   * pagination boundary; this dataset (loan applications, not loan accounts/payments) never
   * approaches it in practice. */
  listXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const EXPORT_LIMIT = 10_000;
      const applications = await this.deps.listLoanApplicationsUseCase.execute({
        limit: EXPORT_LIMIT,
        branchId: resolveBranchFilter(scope),
        ...this.parseListFilters(req),
      });
      const presented = await this.presentMany(applications);
      const rows: LoanApplicationXlsxRow[] = presented.map((app) => ({
        applicant: app.applicantName,
        category: app.requestedCategory,
        amount: Number(app.requestedAmount),
        dtiPercent: app.dtiPercent !== null ? Number(app.dtiPercent) : null,
        riskTier: app.riskTier ?? '—',
        status: STATUS_DISPLAY_LABEL[app.status],
        reason: declineReason(app),
        loanAccount: app.createdLoanAccountCode ?? '—',
        submitted: new Date(app.createdAt),
      }));
      const buffer = await writeTabularXlsx<LoanApplicationXlsxRow>({
        sheetName: 'Loan Applications',
        columns: LOAN_APPLICATION_XLSX_COLUMNS,
        rows,
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Loan Applications.xlsx"');
      res.status(200).send(buffer);
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

  /** 2026-08-10 - see `SetMitigationDetailsUseCase`'s doc comment: generalizes
   * `setMitigationAccountOwner` above to every mitigation field, same status-unrestricted rule. */
  setMitigationDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as SetMitigationDetailsRequestBody;
      const currentUser = getCurrentUser(req);
      const application = await this.deps.setMitigationDetailsUseCase.execute(req.params.id as string, currentUser.sub, body);
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

  /** 2026-09-09 (user request): "Undo" for Tag as Pre Approval - one step back to UNDER_REVIEW. */
  undoPreApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.undoLoanApplicationPreApprovalUseCase.execute(req.params.id as string, currentUser.sub);
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

  /** 2026-09-09 (user request): "Revert to Pre-Approval" - one step back from Approved/Declined. */
  revertToPreApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const application = await this.deps.revertLoanApplicationToPreApprovalUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(200).json(await this.present(application));
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-21 (user request): prints the original application intake as a PDF, saved as an
   * Attachment on the application so it shows up in the client's Attachments tab automatically -
   * see GenerateLoanApplicationFormUseCase's doc comment. Responds with the created Attachment's
   * metadata; the frontend downloads/prints it via the existing `GET /attachments/:id/download`
   * endpoint rather than this one streaming the PDF bytes directly. */
  generateForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const attachment = await this.deps.generateLoanApplicationFormUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-09-09 (user request): "CRM Report" - prints the Credit Evaluation Report data as a PDF,
   * saved as an Attachment on the application (same pattern as generateForm above). Responds with
   * the created Attachment's metadata; the frontend previews it via `GET /attachments/:id/download`. */
  generateCrmReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const attachment = await this.deps.generateCrmReportUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  };

  deleteApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.deleteLoanApplicationUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(204).send();
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
