import { describe, expect, it, vi } from 'vitest';
import { RevertLoanApplicationDecisionUseCase } from '@modules/loan-application/application/use-cases/RevertLoanApplicationDecisionUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { InvalidLoanApplicationTransitionError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

/** 2026-07-17: `preQualificationService` is a required dep (not previously mocked here at all) -
 * revert() always reflects a freshly recomputed system verdict rather than a memorized old value
 * (see the use case's own doc comment), so the use case calls `classify()` before calling the
 * domain's `revert(targetStatus)`. */
function buildPreQualificationService(result: { status: 'PREAPPROVED' | 'PREDECLINED'; distanceFromBranchKm: number | null }) {
  return { classify: vi.fn().mockResolvedValue({ ...result, estimatedMonthlyAmortization: 0 }) };
}

/** 2026-09-12: required dep - the use case checks document completeness to decide whether a
 * revert should land on INCOMPLETE instead of the fresh classification. Stubbed with every
 * category "Salary Loan" requires already present, so these tests' original intent (revert lands
 * on the freshly recomputed PREAPPROVED/PREDECLINED, not INCOMPLETE) is unaffected. */
function buildAttachmentRepository() {
  const categories = ['VALID_ID_BORROWER', 'PROOF_OF_BILLING', 'EMPLOYEE_ID', 'CORPORATE_PAYSLIP', 'CERTIFICATE_OF_EMPLOYMENT'];
  return { listByOwner: vi.fn().mockResolvedValue(categories.map((documentCategory) => ({ documentCategory }))) };
}

function buildDecidedApplication() {
  const application = LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
  });
  application.decline('user-1', 'not eligible');
  return application;
}

describe('RevertLoanApplicationDecisionUseCase', () => {
  it('reverts a decided application back to the freshly recomputed system status and audit-logs the reversal', async () => {
    const application = buildDecidedApplication();
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const preQualificationService = buildPreQualificationService({ status: 'PREAPPROVED', distanceFromBranchKm: 5 });
    const useCase = new RevertLoanApplicationDecisionUseCase({
      loanApplicationRepository,
      auditLogger,
      preQualificationService: preQualificationService as never,
      attachmentRepository: buildAttachmentRepository() as never,
    });

    const result = await useCase.execute(application.id, 'mis-user');

    expect(result.status).toBe('PREAPPROVED');
    expect(loanApplicationRepository.save).toHaveBeenCalledWith(application);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REVERT_LOAN_APPLICATION_DECISION',
        previousValue: { status: 'DECLINED' },
        newValue: { status: 'PREAPPROVED' },
      }),
    );
  });

  it('propagates InvalidLoanApplicationTransitionError for an application still PREAPPROVED/PREDECLINED', async () => {
    const application = LoanApplication.create({
      branchId: 'branch-1',
      applicantName: 'Juan Dela Cruz',
      requestedCategory: 'Salary Loan',
      requestedAmount: 50000,
      requestedTermMonths: 12,
      status: 'PREAPPROVED',
    });
    const loanApplicationRepository = { findById: vi.fn().mockResolvedValue(application), findMany: vi.fn(), save: vi.fn() };
    const auditLogger = { log: vi.fn() };
    const preQualificationService = buildPreQualificationService({ status: 'PREAPPROVED', distanceFromBranchKm: 5 });
    const useCase = new RevertLoanApplicationDecisionUseCase({
      loanApplicationRepository,
      auditLogger,
      preQualificationService: preQualificationService as never,
      attachmentRepository: buildAttachmentRepository() as never,
    });

    await expect(useCase.execute(application.id, 'mis-user')).rejects.toThrow(InvalidLoanApplicationTransitionError);
    expect(loanApplicationRepository.save).not.toHaveBeenCalled();
  });
});
