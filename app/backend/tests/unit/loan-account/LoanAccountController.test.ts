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
    listMaturedLoanAccountIdsUseCase: { execute: vi.fn().mockResolvedValue(new Set()) },
    approveLoanUseCase: { execute: vi.fn() },
    rejectLoanUseCase: { execute: vi.fn() },
    // Milestone 9.1/9.2 CP13.
    activateLoanUseCase: { execute: vi.fn() },
    processPaymentUseCase: { execute: vi.fn() },
    idempotencyKeyStore: { claim: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }), complete: vi.fn(), release: vi.fn() },
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
    const req = { body: { branchId: 'branch-1' }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
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
      authUser: authUser(['Loan Operation Manager'], 'branch-1'),
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
      authUser: authUser(['MIS'], 'branch-1'),
    } as unknown as Request;
    const res = buildResponse();

    await controller.reject(req, res, vi.fn());

    expect(deps.rejectLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'authenticated-user-1', 'Insufficient documents');
  });

  it('list() returns the paginated envelope { items, nextCursor }', async () => {
    const deps = buildDeps();
    const loans = [buildLoan()];
    (deps.listLoanAccountsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loans);
    const controller = new LoanAccountController(deps);
    const req = { query: { limit: '1' }, authUser: authUser(['MIS']) } as unknown as Request;
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
    const req = { params: { id: 'missing' }, authUser: authUser(['MIS']) } as unknown as Request;
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
      const req = { body: { branchId: 'attacker-branch' }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;

      await controller.create(req, buildResponse(), vi.fn());

      expect(deps.createLoanAccountUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
    });

    it('get() forwards ForbiddenError for a different branch, non-global caller', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.get(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('list() filters to the caller\'s own branch for a non-global role', async () => {
      const deps = buildDeps();
      (deps.listLoanAccountsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const controller = new LoanAccountController(deps);
      const req = { query: {}, authUser: authUser(['Collection Officer'], 'branch-1') } as unknown as Request;

      await controller.list(req, buildResponse(), vi.fn());

      expect(deps.listLoanAccountsUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
    });

    it('approve() checks branch access BEFORE mutating — a cross-branch attempt never reaches approveLoanUseCase', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = { params: { id: loan.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
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
      const req = { params: { id: loan.id }, body: {}, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
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
      const req = { params: { id: loan.id }, authUser: authUser(['MIS'], 'branch-1') } as unknown as Request;

      await controller.approve(req, buildResponse(), vi.fn());

      expect(deps.approveLoanUseCase.execute).toHaveBeenCalledWith(loan.id, 'authenticated-user-1');
    });
  });

  // Milestone 9.1/9.2 CP13.
  describe('activate()', () => {
    it('uses ActivateLoanUseCase\'s own returned aggregate directly — no second getLoanAccountUseCase call after mutating', async () => {
      const deps = buildDeps();
      const existing = buildLoan();
      const activated = buildLoan();
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (deps.activateLoanUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(activated);
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: existing.id },
        authUser: authUser(['Loan Operation Manager'], 'branch-1'),
        header: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;
      const res = buildResponse();

      await controller.activate(req, res, vi.fn());

      // getLoanAccountUseCase is called exactly once — for the pre-mutation
      // branch check — not a second time to re-fetch after activating.
      expect(deps.getLoanAccountUseCase.execute).toHaveBeenCalledTimes(1);
      expect(deps.activateLoanUseCase.execute).toHaveBeenCalledWith(existing.id, 'authenticated-user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('checks branch access BEFORE mutating — a cross-branch attempt never reaches activateLoanUseCase', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        authUser: authUser(['Loan Operation Manager'], 'branch-1'),
        header: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;
      const next = vi.fn();

      await controller.activate(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(deps.activateLoanUseCase.execute).not.toHaveBeenCalled();
    });

    it('replays a stored response for a repeated Idempotency-Key instead of calling activateLoanUseCase again', async () => {
      const deps = buildDeps();
      const loan = buildLoan();
      const storedBody = { id: loan.id, status: 'ACTIVE' };
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      (deps.idempotencyKeyStore.claim as ReturnType<typeof vi.fn>).mockResolvedValue({
        outcome: 'COMPLETED',
        response: { statusCode: 200, responseBody: storedBody },
      });
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        authUser: authUser(['Loan Operation Manager'], 'branch-1'),
        header: vi.fn().mockReturnValue('client-key-1'),
      } as unknown as Request;
      const res = buildResponse();

      await controller.activate(req, res, vi.fn());

      expect(deps.activateLoanUseCase.execute).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(storedBody);
    });

    it('stores the response after a successful activation under the supplied Idempotency-Key', async () => {
      const deps = buildDeps();
      const loan = buildLoan();
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      (deps.activateLoanUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        authUser: authUser(['Loan Operation Manager'], 'branch-1'),
        header: vi.fn().mockReturnValue('client-key-1'),
      } as unknown as Request;

      await controller.activate(req, buildResponse(), vi.fn());

      expect(deps.idempotencyKeyStore.claim).toHaveBeenCalledWith(
        'client-key-1',
        'POST /loan-accounts/:id/activate',
        'authenticated-user-1',
      );
      expect(deps.idempotencyKeyStore.complete).toHaveBeenCalledWith(
        'client-key-1',
        'POST /loan-accounts/:id/activate',
        expect.objectContaining({ statusCode: 200 }),
      );
    });
  });

  // Milestone 9.1/9.2 CP13.
  describe('processPayment()', () => {
    it('forwards paymentAmount as Money and returns { loanAccount, remainder }', async () => {
      const deps = buildDeps();
      const loan = buildLoan();
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      (deps.processPaymentUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        loanAccount: loan,
        remainder: Money.of('25.00'),
      });
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        body: { paymentAmount: '500.00', orNumber: 'OR-1001' },
        authUser: authUser(['Collection Officer'], 'branch-1'),
        header: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;
      const res = buildResponse();

      await controller.processPayment(req, res, vi.fn());

      expect(deps.processPaymentUseCase.execute).toHaveBeenCalledWith(
        loan.id,
        expect.objectContaining({}),
        'authenticated-user-1',
        undefined,
        undefined,
        'OR-1001',
        undefined,
      );
      const body = res.json.mock.calls[0]?.[0];
      expect(body.remainder).toBe('25.00');
      expect(typeof body.remainder).toBe('string');
    });

    it('checks branch access BEFORE mutating — a cross-branch attempt never reaches processPaymentUseCase', async () => {
      const deps = buildDeps();
      const loan = buildLoan('branch-2');
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        body: { paymentAmount: '500.00' },
        authUser: authUser(['Collection Officer'], 'branch-1'),
        header: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;
      const next = vi.fn();

      await controller.processPayment(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(deps.processPaymentUseCase.execute).not.toHaveBeenCalled();
    });

    it('replays a stored response for a repeated Idempotency-Key instead of processing the payment again', async () => {
      const deps = buildDeps();
      const loan = buildLoan();
      const storedBody = { loanAccount: { id: loan.id }, remainder: '0.00' };
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
      (deps.idempotencyKeyStore.claim as ReturnType<typeof vi.fn>).mockResolvedValue({
        outcome: 'COMPLETED',
        response: { statusCode: 200, responseBody: storedBody },
      });
      const controller = new LoanAccountController(deps);
      const req = {
        params: { id: loan.id },
        body: { paymentAmount: '500.00' },
        authUser: authUser(['Collection Officer'], 'branch-1'),
        header: vi.fn().mockReturnValue('client-key-2'),
      } as unknown as Request;
      const res = buildResponse();

      await controller.processPayment(req, res, vi.fn());

      expect(deps.processPaymentUseCase.execute).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(storedBody);
    });
  });
});
