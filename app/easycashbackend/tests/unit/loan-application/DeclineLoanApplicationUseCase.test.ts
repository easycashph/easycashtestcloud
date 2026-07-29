import { describe, expect, it, vi } from 'vitest';
import { DeclineLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/DeclineLoanApplicationUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';

function buildApplication(portalAccountId?: string) {
  const application = LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
    portalAccountId,
  });
  application.startReview('reviewer-1');
  return application;
}

describe('DeclineLoanApplicationUseCase', () => {
  it('throws NotFoundError when the application does not exist', async () => {
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(null), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new DeclineLoanApplicationUseCase({ loanApplicationRepository, auditLogger });

    await expect(useCase.execute('missing', 'user-1', undefined)).rejects.toThrow(NotFoundError);
  });

  it('declines, saves, and audit-logs', async () => {
    const application = buildApplication();
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const useCase = new DeclineLoanApplicationUseCase({ loanApplicationRepository, auditLogger });

    const result = await useCase.execute(application.id, 'user-1', 'insufficient income');

    expect(result.status).toBe('DECLINED');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DECLINE_LOAN_APPLICATION', entityType: 'LoanApplication', userId: 'user-1' }),
    );
  });

  it('notifies the portal account when the application was portal-submitted', async () => {
    const application = buildApplication('portal-account-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const useCase = new DeclineLoanApplicationUseCase({ loanApplicationRepository, auditLogger, portalNotificationService });

    await useCase.execute(application.id, 'user-1', 'insufficient income');

    expect(portalNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ portalAccountId: 'portal-account-1', type: 'APPLICATION_DECLINED', entityType: 'LoanApplication', entityId: application.id }),
    );
  });

  it('does not notify the portal when the application was staff-encoded (no portalAccountId)', async () => {
    const application = buildApplication();
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const useCase = new DeclineLoanApplicationUseCase({ loanApplicationRepository, auditLogger, portalNotificationService });

    await useCase.execute(application.id, 'user-1', undefined);

    expect(portalNotificationService.notify).not.toHaveBeenCalled();
  });
});
