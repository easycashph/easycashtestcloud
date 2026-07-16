import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { withIdempotency } from '@shared/http/idempotency';
import { Money } from '@shared/domain/Money';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';
import type { CreateLoanAccountUseCase } from '../../application/use-cases/CreateLoanAccountUseCase';
import type { UpdateLoanAccountUseCase } from '../../application/use-cases/UpdateLoanAccountUseCase';
import type { GetLoanAccountUseCase } from '../../application/use-cases/GetLoanAccountUseCase';
import type { ListLoanAccountsUseCase } from '../../application/use-cases/ListLoanAccountsUseCase';
import type { ListMaturedLoanAccountIdsUseCase } from '../../application/use-cases/ListMaturedLoanAccountIdsUseCase';
import type { ApproveLoanUseCase } from '../../application/use-cases/ApproveLoanUseCase';
import type { UndoApproveLoanUseCase } from '../../application/use-cases/UndoApproveLoanUseCase';
import type { RejectLoanUseCase } from '../../application/use-cases/RejectLoanUseCase';
import type { ActivateLoanUseCase } from '../../application/use-cases/ActivateLoanUseCase';
import type { UndoActivateLoanUseCase } from '../../application/use-cases/UndoActivateLoanUseCase';
import type { ProcessPaymentUseCase } from '../../application/use-cases/ProcessPaymentUseCase';
import type { ReversePaymentUseCase } from '../../application/use-cases/ReversePaymentUseCase';
import type { GetLoanRiskAssessmentUseCase } from '../../application/use-cases/GetLoanRiskAssessmentUseCase';
import type {
  CreateLoanAccountRequestBody,
  ProcessPaymentRequestBody,
  RejectLoanRequestBody,
  ReversePaymentRequestBody,
  UpdateLoanAccountRequestBody,
} from './loanAccountSchemas';
import { presentLoanAccount } from './presenters/LoanAccountPresenter';

export interface LoanAccountControllerDeps {
  createLoanAccountUseCase: CreateLoanAccountUseCase;
  updateLoanAccountUseCase: UpdateLoanAccountUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
  listLoanAccountsUseCase: ListLoanAccountsUseCase;
  listMaturedLoanAccountIdsUseCase: ListMaturedLoanAccountIdsUseCase;
  approveLoanUseCase: ApproveLoanUseCase;
  undoApproveLoanUseCase: UndoApproveLoanUseCase;
  rejectLoanUseCase: RejectLoanUseCase;
  activateLoanUseCase: ActivateLoanUseCase;
  undoActivateLoanUseCase: UndoActivateLoanUseCase;
  processPaymentUseCase: ProcessPaymentUseCase;
  reversePaymentUseCase: ReversePaymentUseCase;
  getLoanRiskAssessmentUseCase: GetLoanRiskAssessmentUseCase;
  idempotencyKeyStore: IIdempotencyKeyStore;
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

  /**
   * 2026-07-16 (Edit Loan Account, user request): PATCH — H-1 branch check before mutating, same
   * "fetch, check, mutate, re-fetch" shape as `approve`/`reject` above. `LoanAccount.update()`
   * itself refuses the whole request once the loan is past PENDING_APPROVAL
   * (`LoanAccountNotEditableError`), so no status check is duplicated here.
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const body = req.body as UpdateLoanAccountRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const loanAccount = await this.deps.updateLoanAccountUseCase.execute(req.params.id as string, body);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, loanAccount.branchId); // H-1: reject cross-branch reads for non-global roles.
      const maturedIds = await this.deps.listMaturedLoanAccountIdsUseCase.execute([loanAccount.id]);
      res.status(200).json(presentLoanAccount(loanAccount, maturedIds.has(loanAccount.id)));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const search = parseSearchParam(req.query);
      const borrowerId = typeof req.query.borrowerId === 'string' ? req.query.borrowerId : undefined;
      const loanAccounts = await this.deps.listLoanAccountsUseCase.execute({
        limit,
        cursor,
        branchId: resolveBranchFilter(scope),
        search,
        borrowerId,
      });
      const maturedIds = await this.deps.listMaturedLoanAccountIdsUseCase.execute(loanAccounts.map((l) => l.id));
      res.status(200).json(
        toPaginatedResponse(
          loanAccounts.map((loanAccount) => presentLoanAccount(loanAccount, maturedIds.has(loanAccount.id))),
          limit,
          (item) => item.id,
        ),
      );
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

  /** 2026-07-16 (Undo Approve, user request, MIS-only) — role gate enforced at the router. */
  undoApprove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      await this.deps.undoApproveLoanUseCase.execute(req.params.id as string, currentUser.sub);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  /** 2026-07-16 (Undo Activate, user request, MIS-only) — role gate enforced at the router. */
  undoActivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      await this.deps.undoActivateLoanUseCase.execute(req.params.id as string, currentUser.sub);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as RejectLoanRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as approve() above.
      await this.deps.rejectLoanUseCase.execute(req.params.id as string, currentUser.sub, body.reason);
      const loanAccount = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanAccount(loanAccount));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Milestone 9.1/9.2 CP13, ADR-038 §3.6. Unlike `approve`/`reject` above
   * (M-1, a known-deferred "mutate then re-fetch" pattern), this uses
   * `ActivateLoanUseCase.execute()`'s own returned aggregate directly — no
   * second `getLoanAccountUseCase` call needed, since that use case already
   * returns the mutated `LoanAccount`. Not a regression of `approve`/
   * `reject`'s pattern; simply doesn't repeat it in new code.
   */
  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = 'POST /loan-accounts/:id/activate';
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      // H-1: verify branch access BEFORE mutating, same as approve()/reject().
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);

      await withIdempotency(this.deps.idempotencyKeyStore, req, res, endpoint, currentUser.sub, async () => {
        const loanAccount = await this.deps.activateLoanUseCase.execute(req.params.id as string, currentUser.sub);
        return { statusCode: 200, body: presentLoanAccount(loanAccount) };
      });
    } catch (error) {
      next(error);
    }
  };

  /** Milestone 9.1/9.2 CP13, ADR-038 §3.6. Same shape as `activate` above. */
  processPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = 'POST /loan-accounts/:id/payments';
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as ProcessPaymentRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);

      await withIdempotency(this.deps.idempotencyKeyStore, req, res, endpoint, currentUser.sub, async () => {
        const paymentAmount = Money.of(body.paymentAmount);
        const manualAllocations = body.allocations?.map((a) => ({
          installmentId: a.installmentId,
          principal: Money.of(a.principal),
          interest: Money.of(a.interest),
          penalty: Money.of(a.penalty),
          fees: Money.of(a.fees),
        }));
        const { loanAccount, remainder, appliedAllocations } = await this.deps.processPaymentUseCase.execute(
          req.params.id as string,
          paymentAmount,
          currentUser.sub,
          body.paidAt,
          manualAllocations,
          body.orNumber,
          body.arNumber,
        );
        return {
          statusCode: 200,
          body: {
            loanAccount: presentLoanAccount(loanAccount),
            remainder: remainder.toString(),
            appliedAllocations: appliedAllocations.map((a) => ({
              repaymentInstallmentId: a.repaymentInstallmentId,
              installmentNumber: a.installmentNumber,
              installmentDueDate: a.installmentDueDate.toISOString(),
              principalApplied: a.principalApplied.toString(),
              interestApplied: a.interestApplied.toString(),
              feesApplied: a.feesApplied.toString(),
              penaltyApplied: a.penaltyApplied.toString(),
            })),
          },
        };
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 2026-07-11 (Reverse Payment feature). MIS-only (enforced by the router's `requireRole('MIS')`,
   * not here — same division of concerns as every other route).
   *
   * 2026-07-11 follow-up: DOES use `withIdempotency`, unlike this doc comment originally claimed —
   * real testing surfaced the gap that reasoning missed. `ReversePaymentUseCase`'s own
   * `TransactionAlreadyReversedError` only catches a duplicate attempt that arrives *after* the
   * first one has already committed; two requests racing to reverse the same transaction can both
   * pass that check before either writes, and the loser then fails with a confusing
   * `ConcurrencyConflictError` ("this loan was just updated by another action") instead of a clear
   * "already in progress" response. Same shape as `activate`/`processPayment` above, except the
   * frontend sends a key derived from the transaction id (not a fresh random one per click) — see
   * `LoanDetailPage.tsx`'s `reverseMutation` — so this specific race is caught deterministically,
   * not just reduced to "usually fine."
   */
  reversePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = 'POST /loan-accounts/:id/transactions/:transactionId/reverse';
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as ReversePaymentRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as approve()/reject()/processPayment() above.

      await withIdempotency(this.deps.idempotencyKeyStore, req, res, endpoint, currentUser.sub, async () => {
        const loanAccount = await this.deps.reversePaymentUseCase.execute(
          req.params.id as string,
          req.params.transactionId as string,
          currentUser.sub,
          body.reason,
        );
        return { statusCode: 200, body: presentLoanAccount(loanAccount) };
      });
    } catch (error) {
      next(error);
    }
  };

  riskAssessment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId);
      const assessment = await this.deps.getLoanRiskAssessmentUseCase.execute(req.params.id as string);
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };
}
