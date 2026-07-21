import { describe, expect, it, vi } from 'vitest';
import { TagLoanApplicationPreApprovalUseCase } from '@modules/loan-application/application/use-cases/TagLoanApplicationPreApprovalUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';
import {
  InvalidLoanApplicationTransitionError,
  MissingAgencyVerificationError,
} from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

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

describe('TagLoanApplicationPreApprovalUseCase', () => {
  it('throws NotFoundError when the application does not exist', async () => {
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(null), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = { findVersionById: vi.fn(), findById: vi.fn() };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('throws InvalidLoanApplicationTransitionError outside UNDER_REVIEW, without saving or auditing', async () => {
    const application = buildApplication('PREAPPROVED');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = { findVersionById: vi.fn(), findById: vi.fn() };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    await expect(useCase.execute(application.id, 'user-1')).rejects.toThrow(InvalidLoanApplicationTransitionError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('tags pre approval, saves, and audit-logs from UNDER_REVIEW', async () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = { findVersionById: vi.fn(), findById: vi.fn() };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    const result = await useCase.execute(application.id, 'reviewer-1');

    expect(result.status).toBe('PRE_APPROVAL');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TAG_LOAN_APPLICATION_PRE_APPROVAL', entityType: 'LoanApplication', userId: 'reviewer-1' }),
    );
  });

  it('throws MissingAgencyVerificationError for a Seafarer Loan with no Agency Verification filled in', async () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    application.assignProduct('version-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = {
      findVersionById: vi.fn().mockResolvedValue({ loanProductId: 'product-1' }),
      findById: vi.fn().mockResolvedValue({ name: 'SML-Regular' }),
    };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    await expect(useCase.execute(application.id, 'reviewer-1')).rejects.toThrow(MissingAgencyVerificationError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
  });

  it('tags pre approval for a Seafarer Loan once Agency Verification is filled in', async () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    application.assignProduct('version-1');
    application.updateReviewReport({
      agencyVerification: { agencyName: 'Manning Agency Co.', position: 'Able Seaman', vessel: 'MV Example' },
    });
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = {
      findVersionById: vi.fn().mockResolvedValue({ loanProductId: 'product-1' }),
      findById: vi.fn().mockResolvedValue({ name: 'SML-Regular' }),
    };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    const result = await useCase.execute(application.id, 'reviewer-1');

    expect(result.status).toBe('PRE_APPROVAL');
  });

  it('does not require Agency Verification for a non-Seafarer product', async () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    application.assignProduct('version-1');
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const loanProductRepository = {
      findVersionById: vi.fn().mockResolvedValue({ loanProductId: 'product-1' }),
      findById: vi.fn().mockResolvedValue({ name: 'SL-Regular' }),
    };
    const useCase = new TagLoanApplicationPreApprovalUseCase({ loanApplicationRepository, loanProductRepository, auditLogger });

    const result = await useCase.execute(application.id, 'reviewer-1');

    expect(result.status).toBe('PRE_APPROVAL');
  });
});
