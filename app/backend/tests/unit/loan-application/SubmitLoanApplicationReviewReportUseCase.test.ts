import { describe, expect, it, vi } from 'vitest';
import { SubmitLoanApplicationReviewReportUseCase } from '@modules/loan-application/application/use-cases/SubmitLoanApplicationReviewReportUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';
import { InvalidLoanApplicationTransitionError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

function buildApplication(status: 'PREAPPROVED' | 'PREDECLINED' = 'PREAPPROVED') {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    submittedDocuments: ['Valid ID'],
    status,
  });
}

describe('SubmitLoanApplicationReviewReportUseCase', () => {
  it('throws NotFoundError when the application does not exist', async () => {
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(null), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new SubmitLoanApplicationReviewReportUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute('missing', 'user-1', { ciNotes: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('throws InvalidLoanApplicationTransitionError outside UNDER_REVIEW, without saving or auditing', async () => {
    const application = buildApplication('PREAPPROVED');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new SubmitLoanApplicationReviewReportUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute(application.id, 'user-1', { ciNotes: 'too early' })).rejects.toThrow(InvalidLoanApplicationTransitionError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('saves the patch and audit-logs while UNDER_REVIEW', async () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new SubmitLoanApplicationReviewReportUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'reviewer-1', {
      creditBureauResult: 'CLEAR',
      checkedDocuments: ['Valid ID'],
    });

    expect(result.reviewReport).toEqual({ creditBureauResult: 'CLEAR', checkedDocuments: ['Valid ID'] });
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_LOAN_APPLICATION_REVIEW_REPORT', entityType: 'LoanApplication', userId: 'reviewer-1' }),
    );
  });
});
