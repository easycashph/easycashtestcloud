import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LedgerController } from '@modules/ledger/interface/http/ledgerController';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { Money } from '@shared/domain/Money';
import { ForbiddenError } from '@shared/errors/DomainError';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    listLoanTransactionsForAccountUseCase: { execute: vi.fn() },
    getLoanTransactionUseCase: { execute: vi.fn() },
  } as never as ConstructorParameters<typeof LedgerController>[0];
}

function buildTransaction(branchId = 'branch-1') {
  return LoanTransaction.create({
    loanAccountId: 'loan-1',
    type: 'DISBURSEMENT',
    amount: Money.of('10000.00'),
    components: { principalComponent: Money.of('10000.00') },
    balanceAfter: Money.of('10000.00'),
    branchId,
    entryDate: new Date(),
  });
}

/** Milestone 8.1 / H-1: every request now needs req.authUser for branch-scope resolution. */
function authUser(roles: string[], branchId = 'branch-1') {
  return { sub: 'user-1', email: 'a@b.com', roles, branchId, jti: 'jti-1' };
}

describe('LedgerController (read-only per D-2 — no write method exists on this class at all)', () => {
  it('has no create/record method', () => {
    const controller = new LedgerController(buildDeps());
    expect((controller as unknown as Record<string, unknown>).create).toBeUndefined();
    expect((controller as unknown as Record<string, unknown>).record).toBeUndefined();
  });

  it('listForAccount() returns { items, nextCursor } with amounts as strings', async () => {
    const deps = buildDeps();
    const txn = buildTransaction();
    (deps.listLoanTransactionsForAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([txn]);
    const controller = new LedgerController(deps);
    const req = {
      params: { loanAccountId: 'loan-1' },
      query: { limit: '1' },
      authUser: authUser(['MIS']),
    } as unknown as Request;
    const res = buildResponse();

    await controller.listForAccount(req, res, vi.fn());

    expect(deps.listLoanTransactionsForAccountUseCase.execute).toHaveBeenCalledWith('loan-1', 1, undefined, undefined);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.items[0].amount).toBe('10000.00');
    expect(typeof body.items[0].amount).toBe('string');
  });

  it('get() returns 200 with the presented transaction', async () => {
    const deps = buildDeps();
    const txn = buildTransaction();
    (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(txn);
    const controller = new LedgerController(deps);
    const req = { params: { id: txn.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
    const res = buildResponse();

    await controller.get(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LedgerController(deps);
    const req = { params: { id: 'missing' }, authUser: authUser(['MIS']) } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // Milestone 8.1 remediation (audit finding H-1).
  describe('branch scoping (H-1)', () => {
    it('listForAccount() filters to the caller\'s own branch for a non-global role', async () => {
      const deps = buildDeps();
      (deps.listLoanTransactionsForAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const controller = new LedgerController(deps);
      const req = { params: { loanAccountId: 'loan-1' }, query: {}, authUser: authUser(['Collection Officer'], 'branch-1') } as unknown as Request;

      await controller.listForAccount(req, buildResponse(), vi.fn());

      expect(deps.listLoanTransactionsForAccountUseCase.execute).toHaveBeenCalledWith('loan-1', 50, undefined, 'branch-1');
    });

    it('get() forwards ForbiddenError for a different branch, non-global caller', async () => {
      const deps = buildDeps();
      const txn = buildTransaction('branch-2');
      (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(txn);
      const controller = new LedgerController(deps);
      const req = { params: { id: txn.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.get(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('get() allows a global caller to read any branch\'s transaction', async () => {
      const deps = buildDeps();
      const txn = buildTransaction('branch-2');
      (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(txn);
      const controller = new LedgerController(deps);
      const req = { params: { id: txn.id }, authUser: authUser(['MIS'], 'branch-1') } as unknown as Request;
      const res = buildResponse();

      await controller.get(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
