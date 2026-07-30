import { describe, expect, it, vi } from 'vitest';
import { UpdateLoanApplicationSelfServiceUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationSelfServiceUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '@modules/loan-application/application/services/LoanApplicationPreQualificationService';

function buildApplication() {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Jane Doe',
    requestedCategory: 'Personal Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
  });
}

function buildDeps(application: LoanApplication | null) {
  const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
    findById: vi.fn().mockResolvedValue(application),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const preQualificationService: Partial<LoanApplicationPreQualificationService> = {
    classify: vi.fn().mockResolvedValue({ status: 'PREDECLINED', distanceFromBranchKm: null }),
  };
  return {
    loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    preQualificationService: preQualificationService as LoanApplicationPreQualificationService,
  };
}

describe('UpdateLoanApplicationSelfServiceUseCase', () => {
  it('applies the patch and re-runs pre-qualification classification', async () => {
    const application = buildApplication();
    const deps = buildDeps(application);

    const result = await new UpdateLoanApplicationSelfServiceUseCase(deps).execute(application.id, { employer: 'Acme Corp' });

    expect(result.toProps().employer).toBe('Acme Corp');
    expect(result.toProps().status).toBe('PREDECLINED'); // re-classified per the mocked service
    expect(deps.preQualificationService.classify).toHaveBeenCalledTimes(1);
    expect(deps.loanApplicationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when the application does not exist', async () => {
    const deps = buildDeps(null);
    await expect(new UpdateLoanApplicationSelfServiceUseCase(deps).execute('missing-id', { employer: 'Acme' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
