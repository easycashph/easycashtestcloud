import { describe, expect, it, vi } from 'vitest';
import { ApproveLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/ApproveLoanApplicationUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';
import { ProductNotAssignedError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

/** 2026-07-17: `approve()` now only succeeds from PRE_APPROVAL (2026-07-16 Under Review / Pre
 * Approval pipeline) - `status` must be supplied at create() and driven to PRE_APPROVAL via the
 * same startReview()/tagPreApproval() path a real application goes through, not assumed. */
function buildApplication() {
  const application = LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
  });
  application.startReview('reviewer-1');
  application.tagPreApproval('reviewer-1');
  return application;
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

  it('notifies the portal account when the application was portal-submitted', async () => {
    const application = LoanApplication.create({
      branchId: 'branch-1',
      applicantName: 'Juan Dela Cruz',
      requestedCategory: 'Salary Loan',
      requestedAmount: 50000,
      requestedTermMonths: 12,
      status: 'PREAPPROVED',
      portalAccountId: 'portal-account-1',
    });
    application.startReview('reviewer-1');
    application.tagPreApproval('reviewer-1');
    application.assignProduct('version-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ApproveLoanApplicationUseCase({ loanApplicationRepository, auditLogger, portalNotificationService });

    await useCase.execute(application.id, 'user-1', 'approved on merit');

    expect(portalNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ portalAccountId: 'portal-account-1', type: 'APPLICATION_APPROVED', entityType: 'LoanApplication', entityId: application.id }),
    );
  });

  it('does not notify the portal when the application was staff-encoded (no portalAccountId)', async () => {
    const application = buildApplication();
    application.assignProduct('version-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const portalNotificationService = { notify: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ApproveLoanApplicationUseCase({ loanApplicationRepository, auditLogger, portalNotificationService });

    await useCase.execute(application.id, 'user-1', undefined);

    expect(portalNotificationService.notify).not.toHaveBeenCalled();
  });
});
