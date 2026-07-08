import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { DashboardController } from '@modules/dashboard/interface/http/dashboardController';
import type { DashboardSummary } from '@modules/dashboard/application/ports/IDashboardRepository';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildRequest(authUser: { roles: string[]; branchId: string }) {
  return { authUser } as unknown as Request;
}

const summary: DashboardSummary = {
  totalActiveLoans: { count: 5, outstandingPrincipalBalance: '100.00' },
  overdueAccounts: { count: 1, atRiskCollectionsBalance: '10.00' },
  collectionsThisMonth: { amount: '20.00' },
  portfolioByProduct: [],
};

describe('DashboardController', () => {
  it('resolves an undefined branch filter for a global (MIS) caller, per branchScope.ts', async () => {
    const getDashboardSummaryUseCase = { execute: vi.fn().mockResolvedValue(summary) };
    const controller = new DashboardController({ getDashboardSummaryUseCase });
    const req = buildRequest({ roles: ['MIS'], branchId: 'hq-branch' });
    const res = buildResponse();

    await controller.getSummary(req, res, vi.fn());

    expect(getDashboardSummaryUseCase.execute).toHaveBeenCalledWith(undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(summary);
  });

  it('scopes to the caller\'s own branch for a non-global role', async () => {
    const getDashboardSummaryUseCase = { execute: vi.fn().mockResolvedValue(summary) };
    const controller = new DashboardController({ getDashboardSummaryUseCase });
    const req = buildRequest({ roles: ['Collection Officer'], branchId: 'branch-2' });
    const res = buildResponse();

    await controller.getSummary(req, res, vi.fn());

    expect(getDashboardSummaryUseCase.execute).toHaveBeenCalledWith('branch-2');
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const error = new Error('boom');
    const getDashboardSummaryUseCase = { execute: vi.fn().mockRejectedValue(error) };
    const controller = new DashboardController({ getDashboardSummaryUseCase });
    const req = buildRequest({ roles: ['MIS'], branchId: 'hq-branch' });
    const res = buildResponse();
    const next = vi.fn();

    await controller.getSummary(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
