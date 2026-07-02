import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { RepaymentController } from '@modules/repayment/interface/http/repaymentController';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    listRepaymentInstallmentsForLoanUseCase: { execute: vi.fn() },
    getRepaymentInstallmentUseCase: { execute: vi.fn() },
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
    const controller = new RepaymentController(deps);
    const req = { params: { loanAccountId: 'loan-1' } } as unknown as Request;
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
    const controller = new RepaymentController(deps);
    const req = { params: { id: installment.id } } as unknown as Request;
    const res = buildResponse();

    await controller.get(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.status).toBe('PENDING');
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getRepaymentInstallmentUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new RepaymentController(deps);
    const req = { params: { id: 'missing' } } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
