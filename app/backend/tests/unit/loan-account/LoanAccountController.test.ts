import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LoanAccountController } from '@modules/loan-account/interface/http/loanAccountController';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    createLoanAccountUseCase: { execute: vi.fn() },
    getLoanAccountUseCase: { execute: vi.fn() },
    listLoanAccountsUseCase: { execute: vi.fn() },
    approveLoanUseCase: { execute: vi.fn() },
    rejectLoanUseCase: { execute: vi.fn() },
  } as never as ConstructorParameters<typeof LoanAccountController>[0];
}

function buildLoan() {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
  });
}

describe('LoanAccountController (thin — presenters handle all Money/Percentage/Date formatting)', () => {
  it('create() returns 201 with the presented loan account, principalAmount as a string', async () => {
    const deps = buildDeps();
    const loan = buildLoan();
    (deps.createLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    const controller = new LoanAccountController(deps);
    const req = { body: {} } as Request;
    const res = buildResponse();

    await controller.create(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.principalAmount).toBe('10000.00');
    expect(typeof body.principalAmount).toBe('string');
  });

  it('approve() uses the AUTHENTICATED user id, not anything from the request body', async () => {
    const deps = buildDeps();
    const loan = buildLoan();
    (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    const controller = new LoanAccountController(deps);
    const req = {
      params: { id: loan.id },
      body: { approvedByUserId: 'attacker-supplied-id' },
      authUser: { sub: 'authenticated-user-1', email: 'a@b.com', roles: ['Manager'], branchId: 'branch-1', jti: 'jti-1' },
    } as unknown as Request;
    const res = buildResponse();

    await controller.approve(req, res, vi.fn());

    expect(deps.approveLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'authenticated-user-1');
  });

  it('reject() forwards the optional reason from the request body', async () => {
    const deps = buildDeps();
    const loan = buildLoan();
    (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    const controller = new LoanAccountController(deps);
    const req = { params: { id: loan.id }, body: { reason: 'Insufficient documents' } } as unknown as Request;
    const res = buildResponse();

    await controller.reject(req, res, vi.fn());

    expect(deps.rejectLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'Insufficient documents');
  });

  it('list() returns the paginated envelope { items, nextCursor }', async () => {
    const deps = buildDeps();
    const loans = [buildLoan()];
    (deps.listLoanAccountsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loans);
    const controller = new LoanAccountController(deps);
    const req = { query: { limit: '1' } } as unknown as Request;
    const res = buildResponse();

    await controller.list(req, res, vi.fn());

    const body = res.json.mock.calls[0]?.[0];
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe(loans[0]!.id);
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LoanAccountController(deps);
    const req = { params: { id: 'missing' } } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
