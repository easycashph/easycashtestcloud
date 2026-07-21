import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { RepaymentController } from '@modules/repayment/interface/http/repaymentController';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { ForbiddenError } from '@shared/errors/DomainError';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    listRepaymentInstallmentsForLoanUseCase: { execute: vi.fn() },
    getRepaymentInstallmentUseCase: { execute: vi.fn() },
    getLoanAccountUseCase: { execute: vi.fn() },
    // ADR-053: resolveSecMc3Coverage() looks this up to build PenaltyComputationContext.isSecMc3Covered.
    loanProductRepository: {
      findVersionById: vi.fn().mockResolvedValue({ id: 'version-1', loanProductId: 'product-1' }),
      findById: vi.fn().mockResolvedValue({ id: 'product-1', isUnsecuredGeneralPurpose: false }),
    },
  } as never as ConstructorParameters<typeof RepaymentController>[0];
}

function buildInstallment() {
  return RepaymentInstallment.create({
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate: new Date(Date.now() + 86_400_000),
    due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
  });
}

/** Milestone 8.1 / H-1: every request now needs req.authUser; branch checks go through the parent loan account, not the installment itself. */
function authUser(roles: string[], branchId = 'branch-1') {
  return { sub: 'user-1', email: 'a@b.com', roles, branchId, jti: 'jti-1' };
}

describe('RepaymentController (read-only per D-2 — no write method exists on this class at all)', () => {
  it('has no create/record method', () => {
    const controller = new RepaymentController(buildDeps());
    expect((controller as unknown as Record<string, unknown>).create).toBeUndefined();
    expect((controller as unknown as Record<string, unknown>).recordPayment).toBeUndefined();
  });

  it('listForLoan() returns { items, nextCursor: null } (genuinely unpaginated by design)', async () => {
    const deps = buildDeps();
    const installment = buildInstallment();
    (deps.listRepaymentInstallmentsForLoanUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([installment]);
    (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      branchId: 'branch-1',
      principalAmount: Money.of('50000.00'),
      legacyId: undefined,
      loanProductVersionId: 'version-1',
      installmentCount: 4,
      firstRepaymentDate: new Date('2023-01-01'),
    });
    const controller = new RepaymentController(deps);
    const req = { params: { loanAccountId: 'loan-1' }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
    const res = buildResponse();

    await controller.listForLoan(req, res, vi.fn());

    expect(deps.listRepaymentInstallmentsForLoanUseCase.execute).toHaveBeenCalledWith('loan-1');
    const body = res.json.mock.calls[0]?.[0];
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
    expect(body.items[0].due.principal).toBe('800.00');
  });

  it('get() returns 200 with the presented installment, status included as a derived field', async () => {
    const deps = buildDeps();
    const installment = buildInstallment();
    (deps.getRepaymentInstallmentUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(installment);
    (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      branchId: 'branch-1',
      principalAmount: Money.of('50000.00'),
      legacyId: undefined,
      loanProductVersionId: 'version-1',
      installmentCount: 4,
      firstRepaymentDate: new Date('2023-01-01'),
    });
    const controller = new RepaymentController(deps);
    const req = { params: { id: installment.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
    const res = buildResponse();

    await controller.get(req, res, vi.fn());

    expect(deps.getLoanAccountUseCase.execute).toHaveBeenCalledWith(installment.loanAccountId);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.status).toBe('PENDING');
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getRepaymentInstallmentUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new RepaymentController(deps);
    const req = { params: { id: 'missing' }, authUser: authUser(['MIS']) } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // Milestone 8.1 remediation (audit finding H-1): RepaymentInstallment
  // has no branchId of its own, so branch access is checked via the
  // parent LoanAccount fetched through getLoanAccountUseCase.
  describe('branch scoping (H-1)', () => {
    it('listForLoan() forwards ForbiddenError when the loan account belongs to a different branch', async () => {
      const deps = buildDeps();
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ branchId: 'branch-2' });
      const controller = new RepaymentController(deps);
      const req = { params: { loanAccountId: 'loan-1' }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.listForLoan(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(deps.listRepaymentInstallmentsForLoanUseCase.execute).not.toHaveBeenCalled();
    });

    it('get() forwards ForbiddenError when the installment\'s loan account belongs to a different branch', async () => {
      const deps = buildDeps();
      const installment = buildInstallment();
      (deps.getRepaymentInstallmentUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(installment);
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ branchId: 'branch-2' });
      const controller = new RepaymentController(deps);
      const req = { params: { id: installment.id }, authUser: authUser(['Loan Operation Manager'], 'branch-1') } as unknown as Request;
      const next = vi.fn();

      await controller.get(req, buildResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('allows a global caller to read any branch\'s schedule', async () => {
      const deps = buildDeps();
      (deps.listRepaymentInstallmentsForLoanUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (deps.getLoanAccountUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        branchId: 'branch-2',
        legacyId: undefined,
        loanProductVersionId: 'version-1',
        installmentCount: 4,
        firstRepaymentDate: new Date('2023-01-01'),
      });
      const controller = new RepaymentController(deps);
      const req = { params: { loanAccountId: 'loan-1' }, authUser: authUser(['MIS'], 'branch-1') } as unknown as Request;
      const res = buildResponse();

      await controller.listForLoan(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
