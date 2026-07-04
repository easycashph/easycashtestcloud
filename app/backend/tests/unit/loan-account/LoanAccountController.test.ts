import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LoanAccountController } from '@modules/loan-account/interface/http/loanAccountController';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { ForbiddenError } from '@shared/errors/DomainError';

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

function buildLoan(branchId = 'branch-1') {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId,
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 12,
    firstRepaymentDate: new Date('2026-08-15'),
  });
}

/** Milestone 8.1 / H-1: every request now needs req.authUser for branch-scope resolution. */
function authUser(roles: string[], branchId = 'branch-1') {
  return { sub: 'authenticated-user-1', email: 'a@b.com', roles, branchId, jti: 'jti-1' };
}

describe('LoanAccountController (thin — presenters handle all Money/Percentage/Date formatting)', () => {
  it('create() returns 201 with the presented loan account, principalAmount as a string', async () => {
    const deps = buildDeps();
    const loan = buildLoan();
    (deps.createLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    const controller = new LoanAccountController(deps);
    const req = { body: { branchId: 'branch-1' }, authUser: authUser(['Loan Officer'], 'branch-1') } as unknown as Request;
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
      authUser: authUser(['Manager'], 'branch-1'),
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
    const req = {
      params: { id: loan.id },
      body: { reason: 'Insufficient documents' },
      authUser: authUser(['Administrator'], 'branch-1'),
    } as unknown as Request;
    const res = buildResponse();

    await controller.reject(req, res, vi.fn());

    expect(deps.rejectLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'Insufficient documents');
  });

  it('list() returns the paginated envelope { items, nextCursor }', async () => {
    const deps = buildDeps();
    const loans = [buildLoan()];
    (deps.listLoanAccountsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loans);
    const controller = new LoanAccountController(deps);
    const req = { query: { limit: '1' }, authUser: authUser(['Administrator']) } as unknown as Request;
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
    const req = { params: { id: 'missing' }, authUser: authUser(['Administrator']) } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // Milestone 8.1 remediation (audit finding H-1).
  describe('branch scoping (H-1)', () => {
    it('create() overrides a branch-scoped caller\'s requested branchId with their own', async () => {
      const deps = buildDeps();
      const loan = buildLoan();
      (deps.createLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { body: { branchId: 'attacker-branch' }, authUser: authUser(['Loan Officer'], 'branch-1') } as unknown as Request;

      await controller.create(req, buildResponse(), vi.fn());

      expect(deps.createLoanAccountUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
    });

    it('get() forwards ForbiddenError for a different branch, non-global caller', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, authUser: authUser(['Loan Officer'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.get(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('list() filters to the caller\'s own branch for a non-global role', async () => {
      const deps = buildDeps();
      (deps.listLoanAccountsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const controller = new LoanAccountController(deps);
      const req = { query: {}, authUser: authUser(['Cashier'], 'branch-1') } as unknown as Request;

      await controller.list(req, buildResponse(), vi.fn());

      expect(deps.listLoanAccountsUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
    });

    it('approve() checks branch access BEFORE mutating — a cross-branch attempt never reaches approveLoanUseCase', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, authUser: authUser(['Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.approve(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(deps.approveLoanUseCase.execute).not.toHaveBeenCalled();
    });

    it('reject() checks branch access BEFORE mutating — a cross-branch attempt never reaches rejectLoanUseCase', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, body: {}, authUser: authUser(['Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.reject(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(deps.rejectLoanUseCase.execute).not.toHaveBeenCalled();
    });

    it('approve() allows a global caller to approve any branch\'s loan', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, authUser: authUser(['Administrator'], 'branch-1') } as unknown as Request;

      await controller.approve(req, buildResponse(), vi.fn());

      expect(deps.approveLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'authenticated-user-1');
    });
  });
});
