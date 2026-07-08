import { describe, expect, it, vi } from 'vitest';
import { RevertLoanApplicationDecisionUseCase } from '@modules/loan-application/application/use-cases/RevertLoanApplicationDecisionUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { InvalidLoanApplicationTransitionError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

function buildDecidedApplication() {
  const application = LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
  });
  application.decline('user-1', 'not eligible');
  return application;
}

describe('RevertLoanApplicationDecisionUseCase', () => {
  it('reverts a decided application back to PENDING_REVIEW and audit-logs the reversal', async () => {
    const application = buildDecidedApplication();
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new RevertLoanApplicationDecisionUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'mis-user');

    expect(result.status).toBe('PENDING_REVIEW');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REVERT_LOAN_APPLICATION_DECISION',
        previousValue: { status: 'DECLINED' },
        newValue: { status: 'PENDING_REVIEW' },
      }),
    );
  });

  it('propagates InvalidLoanApplicationTransitionError for an application still PENDING_REVIEW', async () => {
    const application = LoanApplication.create({
      branchId: 'branch-1',
      applicantName: 'Juan Dela Cruz',
      requestedCategory: 'Salary Loan',
      requestedAmount: 50000,
      requestedTermMonths: 12,
    });
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new RevertLoanApplicationDecisionUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute(application.id, 'mis-user')).rejects.toThrow(InvalidLoanApplicationTransitionError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
  });
});
