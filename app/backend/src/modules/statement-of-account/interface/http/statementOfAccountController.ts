import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { resolveBranchScope, assertBranchAccess } from '@shared/http/branchScope';
import { withIdempotency } from '@shared/http/idempotency';
import { NotFoundError } from '@shared/errors/DomainError';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';
import { Money } from '@shared/domain/Money';
import type { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import type { GenerateStatementOfAccountUseCase } from '../../application/use-cases/GenerateStatementOfAccountUseCase';
import type { ListStatementsOfAccountUseCase } from '../../application/use-cases/ListStatementsOfAccountUseCase';
import type { GetGeneratedStatementOfAccountFileUseCase } from '../../application/use-cases/GetGeneratedStatementOfAccountFileUseCase';
import type { GenerateStatementOfAccountRequestBody } from './statementOfAccountSchemas';
import { presentGeneratedStatementOfAccount, presentStatementOfAccountListItem } from './presenters/StatementOfAccountPresenter';

export interface StatementOfAccountControllerDeps {
  generateStatementOfAccountUseCase: GenerateStatementOfAccountUseCase;
  listStatementsOfAccountUseCase: ListStatementsOfAccountUseCase;
  getGeneratedStatementOfAccountFileUseCase: GetGeneratedStatementOfAccountFileUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
  idempotencyKeyStore: IIdempotencyKeyStore;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture). Mirrors `LoanDocumentController`'s access-check pattern exactly. */
export class StatementOfAccountController {
  constructor(private readonly deps: StatementOfAccountControllerDeps) {}

  generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = 'POST /loan-accounts/:id/statements-of-account';
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as GenerateStatementOfAccountRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource write.

      await withIdempotency(this.deps.idempotencyKeyStore, req, res, endpoint, currentUser.sub, async () => {
        const statement = await this.deps.generateStatementOfAccountUseCase.execute({
          loanAccountId: req.params.id as string,
          penaltyFromDate: new Date(`${body.penaltyFromDate}T00:00:00.000Z`),
          penaltyToDate: new Date(`${body.penaltyToDate}T00:00:00.000Z`),
          accruedInterestAsOfDate: new Date(`${body.accruedInterestAsOfDate}T00:00:00.000Z`),
          collectionFee: Money.of(body.collectionFee),
          otherFee: Money.of(body.otherFee),
          generatedByUserId: currentUser.sub,
        });
        return { statusCode: 201, body: presentGeneratedStatementOfAccount(statement) };
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const items = await this.deps.listStatementsOfAccountUseCase.execute(req.params.id as string);
      res.status(200).json({ items: items.map(presentStatementOfAccountListItem) });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const file = await this.deps.getGeneratedStatementOfAccountFileUseCase.execute(req.params.generatedStatementId as string);
      // Same cross-check as LoanDocumentController.download — guards against a mismatched (loanAccountId, generatedStatementId) pair bypassing the branch check above.
      if (file.loanAccountId !== req.params.id) {
        throw new NotFoundError('GeneratedStatementOfAccount', req.params.generatedStatementId as string);
      }
      res.setHeader('Content-Type', 'application/pdf');
      // No filename= here (2026-07-22) - see the matching comment in LoanDocumentController.ts.
      res.setHeader('Content-Disposition', 'attachment');
      res.status(200).send(file.buffer);
    } catch (error) {
      next(error);
    }
  };
}
