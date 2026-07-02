import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LoanProductController } from '@modules/loan-product/interface/http/loanProductController';
import { LoanProduct } from '@modules/loan-product/domain/LoanProduct';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    createLoanProductUseCase: { execute: vi.fn() },
    getLoanProductUseCase: { execute: vi.fn() },
    listLoanProductsUseCase: { execute: vi.fn() },
    createLoanProductVersionUseCase: { execute: vi.fn() },
    activateLoanProductVersionUseCase: { execute: vi.fn() },
  } as never as ConstructorParameters<typeof LoanProductController>[0];
}

describe('LoanProductController (thin — presenters handle all Money/Percentage/Date formatting)', () => {
  it('create() returns 201 with the presented product', async () => {
    const deps = buildDeps();
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    (deps.createLoanProductUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    const controller = new LoanProductController(deps);
    const req = { body: { code: 'PL-01', name: 'Personal Loan' } } as Request;
    const res = buildResponse();

    await controller.create(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: product.id, code: 'PL-01' }));
  });

  it('createVersion() forwards the route param id as loanProductId, then returns the refreshed product', async () => {
    const deps = buildDeps();
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    (deps.getLoanProductUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    const controller = new LoanProductController(deps);
    const req = {
      params: { id: product.id },
      body: { versionNumber: 1, effectiveFrom: new Date(), interestCalculationMethod: 'FLAT', loanAmountMin: '1000.00', installmentCountMin: 6 },
    } as unknown as Request;
    const res = buildResponse();

    await controller.createVersion(req, res, vi.fn());

    expect(deps.createLoanProductVersionUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ loanProductId: product.id, versionNumber: 1 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('activateVersion() forwards both route params, then returns the refreshed product', async () => {
    const deps = buildDeps();
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    (deps.getLoanProductUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    const controller = new LoanProductController(deps);
    const req = { params: { id: product.id, versionId: 'v-1' } } as unknown as Request;
    const res = buildResponse();

    await controller.activateVersion(req, res, vi.fn());

    expect(deps.activateLoanProductVersionUseCase.execute).toHaveBeenCalledWith(product.id, 'v-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getLoanProductUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LoanProductController(deps);
    const req = { params: { id: 'missing' } } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
