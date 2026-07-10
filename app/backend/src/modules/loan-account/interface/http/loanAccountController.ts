import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { withIdempotency } from '@shared/http/idempotency';
import { Money } from '@shared/domain/Money';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';
import type { CreateLoanAccountUseCase } from '../../application/use-cases/CreateLoanAccountUseCase';
import type { GetLoanAccountUseCase } from '../../application/use-cases/GetLoanAccountUseCase';
import type { ListLoanAccountsUseCase } from '../../application/use-cases/ListLoanAccountsUseCase';
import type { ApproveLoanUseCase } from '../../application/use-cases/ApproveLoanUseCase';
import type { RejectLoanUseCase } from '../../application/use-cases/RejectLoanUseCase';
import type { ActivateLoanUseCase } from '../../application/use-cases/ActivateLoanUseCase';
import type { ProcessPaymentUseCase } from '../../application/use-cases/ProcessPaymentUseCase';
import type { CreateLoanAccountRequestBody, ProcessPaymentRequestBody, RejectLoanRequestBody } from './loanAccountSchemas';
import { presentLoanAccount } from './presenters/LoanAccountPresenter';

export interface LoanAccountControllerDeps {
  createLoanAccountUseCase: CreateLoanAccountUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
  listLoanAccountsUseCase: ListLoanAccountsUseCase;
  approveLoanUseCase: ApproveLoanUseCase;
  rejectLoanUseCase: RejectLoanUseCase;
  activateLoanUseCase: ActivateLoanUseCase;
  processPaymentUseCase: ProcessPaymentUseCase;
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
      const search = parseSearchParam(req.query);
      const borrowerId = typeof req.query.borrowerId === 'string' ? req.query.borrowerId : undefined;
      const loanAccounts = await this.deps.listLoanAccountsUseCase.execute({
        limit,
        cursor,
        branchId: resolveBranchFilter(scope),
        search,
        borrowerId,
      });
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
        const { loanAccount, remainder } = await this.deps.processPaymentUseCase.execute(
          req.params.id as string,
          paymentAmount,
          currentUser.sub,
          body.paidAt,
          manualAllocations,
        );
        return {
          statusCode: 200,
          body: { loanAccount: presentLoanAccount(loanAccount), remainder: remainder.toString() },
        };
      });
    } catch (error) {
      next(error);
    }
  };
}
