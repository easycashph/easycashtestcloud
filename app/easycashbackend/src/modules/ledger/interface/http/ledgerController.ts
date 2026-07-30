import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { ListLoanTransactionsForAccountUseCase } from '../../application/use-cases/ListLoanTransactionsForAccountUseCase';
import type { GetLoanTransactionUseCase } from '../../application/use-cases/GetLoanTransactionUseCase';
import type { ListPaymentAllocationsForTransactionUseCase } from '../../application/use-cases/ListPaymentAllocationsForTransactionUseCase';
import { presentLoanTransaction } from './presenters/LoanTransactionPresenter';
import { presentPaymentAllocation } from './presenters/PaymentAllocationPresenter';

export interface LedgerControllerDeps {
  listLoanTransactionsForAccountUseCase: ListLoanTransactionsForAccountUseCase;
  getLoanTransactionUseCase: GetLoanTransactionUseCase;
  listPaymentAllocationsForTransactionUseCase: ListPaymentAllocationsForTransactionUseCase;
}

/**
 * Thin, READ-ONLY controller (D-2, approved): no write endpoint is exposed
 * for RecordLoanTransactionUseCase — it remains an internal application
 * primitive until the calculation engine exists to be its real caller.
 */
export class LedgerController {
  constructor(private readonly deps: LedgerControllerDeps) {}

  listForAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const transactions = await this.deps.listLoanTransactionsForAccountUseCase.execute(
        req.params.loanAccountId as string,
        limit,
        cursor,
        resolveBranchFilter(scope), // H-1: filters to the caller's own branch's transactions unless global.
      );
      res.status(200).json(toPaginatedResponse(transactions.map(presentLoanTransaction), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const transaction = await this.deps.getLoanTransactionUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, transaction.branchId); // H-1: reject cross-branch reads for non-global roles.
      res.status(200).json(presentLoanTransaction(transaction));
    } catch (error) {
      next(error);
    }
  };

  listAllocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { transaction, allocations } = await this.deps.listPaymentAllocationsForTransactionUseCase.execute(
        req.params.id as string,
      );
      assertBranchAccess(scope, transaction.branchId); // H-1: same rule as the single-transaction read.
      res.status(200).json({ allocations: allocations.map(presentPaymentAllocation) });
    } catch (error) {
      next(error);
    }
  };
}
