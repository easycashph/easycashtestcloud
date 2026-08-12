import { describe, expect, it, vi } from 'vitest';
import { StartLoanApplicationReviewUseCase } from '@modules/loan-application/application/use-cases/StartLoanApplicationReviewUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';

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

describe('StartLoanApplicationReviewUseCase', () => {
  it('throws NotFoundError when the application does not exist', async () => {
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(null), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new StartLoanApplicationReviewUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('starts the review, saves, and audit-logs from PREDECLINED too (2026-08-12: PREDECLINED is an advisory system verdict, not a block on human review)', async () => {
    const application = buildApplication('PREDECLINED');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new StartLoanApplicationReviewUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'user-1');

    expect(result.status).toBe('UNDER_REVIEW');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalled();
  });

  it('starts the review, saves, and audit-logs from PREAPPROVED', async () => {
    const application = buildApplication('PREAPPROVED');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new StartLoanApplicationReviewUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'user-1');

    expect(result.status).toBe('UNDER_REVIEW');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'START_LOAN_APPLICATION_REVIEW', entityType: 'LoanApplication', userId: 'user-1' }),
    );
  });
});
