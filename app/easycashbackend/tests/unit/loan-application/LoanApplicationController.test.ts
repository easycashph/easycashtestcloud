import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LoanApplicationController } from '@modules/loan-application/interface/http/loanApplicationController';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

/** 2026-07-17: `buildLinkage`/`buildBreakdown` (private, called by both `present()` and
 * `presentMany()`) need `borrowerRepository`/`loanAccountRepository`/`preQualificationService` -
 * previously missing here entirely. `create()`/`approve()`'s assertions only happened to still
 * pass because `res.status(200).json(await this.present(...))` calls `res.status(200)`
 * synchronously before awaiting `present()`, so a thrown error there went unnoticed by those two
 * tests - but `list()` awaits `presentMany()` in a separate statement first, so it genuinely never
 * reached `res.status` at all. Also replaced the stale `markLoanApplicationReviewedUseCase` (no
 * longer a controller dep since the 2026-07-16 Under Review / Pre Approval pipeline) with the
 * current deps shape. */
function buildDeps() {
  return {
    createLoanApplicationUseCase: { execute: vi.fn() },
    getLoanApplicationUseCase: { execute: vi.fn() },
    listLoanApplicationsUseCase: { execute: vi.fn() },
    assignLoanApplicationProductUseCase: { execute: vi.fn() },
    approveLoanApplicationUseCase: { execute: vi.fn() },
    declineLoanApplicationUseCase: { execute: vi.fn() },
    revertLoanApplicationDecisionUseCase: { execute: vi.fn() },
    startLoanApplicationReviewUseCase: { execute: vi.fn() },
    submitLoanApplicationReviewReportUseCase: { execute: vi.fn() },
    tagLoanApplicationPreApprovalUseCase: { execute: vi.fn() },
    updateLoanApplicationUseCase: { execute: vi.fn() },
    preQualificationService: { classify: vi.fn(), evaluateCriteria: vi.fn().mockReturnValue({} as never) },
    borrowerRepository: {
      findBySourceApplicationId: vi.fn().mockResolvedValue(null),
      findManyBySourceApplicationIds: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
    },
    loanAccountRepository: {
      findBySourceApplicationId: vi.fn().mockResolvedValue(null),
      findManyBySourceApplicationIds: vi.fn().mockResolvedValue([]),
    },
  } as never as ConstructorParameters<typeof LoanApplicationController>[0];
}

function buildApplication() {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
  });
}

describe('LoanApplicationController (thin — presenters handle all shaping)', () => {
  it('create() overrides a non-global caller\'s requested branchId with their own (H-1 pattern)', async () => {
    const deps = buildDeps();
    const application = buildApplication();
    (deps.createLoanApplicationUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(application);
    const controller = new LoanApplicationController(deps);
    const req = {
      body: { branchId: 'someone-elses-branch', applicantName: 'Juan', requestedCategory: 'Salary Loan', requestedAmount: 50000, requestedTermMonths: 12 },
      authUser: { sub: 'user-1', email: 'crm@easycash.ph', roles: ['CRM'], branchId: 'own-branch', jti: 'jti-1' },
    } as unknown as Request;
    const res = buildResponse();

    await controller.create(req, res, vi.fn());

    expect(deps.createLoanApplicationUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'own-branch' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('list() returns the paginated envelope { items, nextCursor }', async () => {
    const deps = buildDeps();
    const applications = [buildApplication()];
    (deps.listLoanApplicationsUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(applications);
    const controller = new LoanApplicationController(deps);
    const req = {
      query: { limit: '1' },
      authUser: { sub: 'user-1', email: 'mis@easycash.ph', roles: ['MIS'], branchId: 'hq-branch', jti: 'jti-1' },
    } as unknown as Request;
    const res = buildResponse();

    await controller.list(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(applications[0]!.id);
  });

  it('approve() forwards the authenticated user id as reviewedByUserId', async () => {
    const deps = buildDeps();
    const application = buildApplication();
    application.assignProduct('version-1');
    (deps.approveLoanApplicationUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(application);
    const controller = new LoanApplicationController(deps);
    const req = {
      params: { id: application.id },
      body: { decisionNote: 'approved' },
      authUser: { sub: 'reviewer-1', email: 'crm@easycash.ph', roles: ['CRM'], branchId: 'branch-1', jti: 'jti-1' },
    } as unknown as Request;
    const res = buildResponse();

    await controller.approve(req, res, vi.fn());

    expect(deps.approveLoanApplicationUseCase.execute).toHaveBeenCalledWith(application.id, 'reviewer-1', 'approved');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.getLoanApplicationUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LoanApplicationController(deps);
    const req = {
      params: { id: 'missing' },
      authUser: { sub: 'user-1', email: 'mis@easycash.ph', roles: ['MIS'], branchId: 'hq-branch', jti: 'jti-1' },
    } as unknown as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.get(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
