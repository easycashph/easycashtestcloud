import { describe, expect, it, vi } from 'vitest';
import { ApproveLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/ApproveLoanApplicationUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';
import { ProductNotAssignedError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

function buildApplication() {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
  });
}

describe('ApproveLoanApplicationUseCase', () => {
  it('throws NotFoundError when the application does not exist', async () => {
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(null), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new ApproveLoanApplicationUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute('missing', 'user-1', undefined)).rejects.toThrow(NotFoundError);
  });

  it('rejects approval when no product sub-type is assigned, without saving or auditing', async () => {
    const application = buildApplication();
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new ApproveLoanApplicationUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute(application.id, 'user-1', undefined)).rejects.toThrow(ProductNotAssignedError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('approves, saves, and audit-logs when a product sub-type is assigned', async () => {
    const application = buildApplication();
    application.assignProduct('version-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new ApproveLoanApplicationUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'user-1', 'approved on merit');

    expect(result.status).toBe('APPROVED');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'APPROVE_LOAN_APPLICATION', entityType: 'LoanApplication', userId: 'user-1' }),
    );
  });
});
