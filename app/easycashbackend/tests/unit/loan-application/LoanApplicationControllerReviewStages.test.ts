import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { LoanApplicationController } from '@modules/loan-application/interface/http/loanApplicationController';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

/** Fully-stubbed deps (including preQualificationService/borrowerRepository/loanAccountRepository,
 * which the shared `present()` helper needs) - unlike the existing LoanApplicationController.test.ts's
 * buildDeps(), which omits them and only coincidentally avoids exercising that path. */
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
    preQualificationService: { evaluateCriteria: vi.fn().mockReturnValue({ status: 'PREAPPROVED', checks: {} }) },
    borrowerRepository: { findBySourceApplicationId: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null) },
    loanAccountRepository: { findBySourceApplicationId: vi.fn().mockResolvedValue(null) },
  } as never as ConstructorParameters<typeof LoanApplicationController>[0];
}

function buildApplication(status: 'PREAPPROVED' | 'PREDECLINED' = 'PREAPPROVED') {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status,
  });
}

function buildAuthedRequest(overrides: Partial<Request> = {}): Request {
  return {
    authUser: { sub: 'user-1', email: 'crm@easycash.ph', roles: ['CRM'], branchId: 'branch-1', jti: 'jti-1' },
    ...overrides,
  } as unknown as Request;
}

describe('LoanApplicationController - Under Review / Pre Approval stages', () => {
  it('startReview() forwards the authenticated user id and returns 200', async () => {
    const deps = buildDeps();
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    (deps.startLoanApplicationReviewUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(application);
    const controller = new LoanApplicationController(deps);
    const req = buildAuthedRequest({ params: { id: application.id } } as Partial<Request>);
    const res = buildResponse();

    await controller.startReview(req, res, vi.fn());

    expect(deps.startLoanApplicationReviewUseCase.execute).toHaveBeenCalledWith(application.id, 'user-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('submitReviewReport() forwards the body and the authenticated user id', async () => {
    const deps = buildDeps();
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    (deps.submitLoanApplicationReviewReportUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(application);
    const controller = new LoanApplicationController(deps);
    const req = buildAuthedRequest({
      params: { id: application.id },
      body: { ciNotes: 'visited residence', creditBureauResult: 'CLEAR' },
    } as Partial<Request>);
    const res = buildResponse();

    await controller.submitReviewReport(req, res, vi.fn());

    expect(deps.submitLoanApplicationReviewReportUseCase.execute).toHaveBeenCalledWith(application.id, 'user-1', {
      ciNotes: 'visited residence',
      creditBureauResult: 'CLEAR',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('tagPreApproval() forwards the authenticated user id and returns 200', async () => {
    const deps = buildDeps();
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.tagPreApproval('user-2');
    (deps.tagLoanApplicationPreApprovalUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(application);
    const controller = new LoanApplicationController(deps);
    const req = buildAuthedRequest({ params: { id: application.id } } as Partial<Request>);
    const res = buildResponse();

    await controller.tagPreApproval(req, res, vi.fn());

    expect(deps.tagLoanApplicationPreApprovalUseCase.execute).toHaveBeenCalledWith(application.id, 'user-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards a thrown error from startReview() to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.startLoanApplicationReviewUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new LoanApplicationController(deps);
    const req = buildAuthedRequest({ params: { id: 'missing' } } as Partial<Request>);
    const res = buildResponse();
    const next = vi.fn();

    await controller.startReview(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
