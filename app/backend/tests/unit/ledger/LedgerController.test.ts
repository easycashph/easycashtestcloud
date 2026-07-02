import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LedgerController } from '@modules/ledger/interface/http/ledgerController';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { Money } from '@shared/domain/Money';

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

function buildTransaction() {
  return LoanTransaction.create({
    loanAccountId: 'loan-1',
    type: 'DISBURSEMENT',
    amount: Money.of('10000.00'),
    components: { principalComponent: Money.of('10000.00') },
    balanceAfter: Money.of('10000.00'),
    branchId: 'branch-1',
    entryDate: new Date(),
  });
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
    const req = { params: { loanAccountId: 'loan-1' }, query: { limit: '1' } } as unknown as Request;
    const res = buildResponse();

    await controller.listForAccount(req, res, vi.fn());

    expect(deps.listLoanTransactionsForAccountUseCase.execute).toHaveBeenCalledWith('loan-1', 1, undefined);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.items[0].amount).toBe('10000.00');
    expect(typeof body.items[0].amount).toBe('string');
  });

  it('get() returns 200 with the presented transaction', async () => {
    const deps = buildDeps();
    const txn = buildTransaction();
    (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(txn);
    const controller = new LedgerController(deps);
    const req = { params: { id: txn.id } } as unknown as Request;
    const res = buildResponse();

    await controller.get(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getLoanTransactionUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LedgerController(deps);
    const req = { params: { id: 'missing' } } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
