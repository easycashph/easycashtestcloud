import { describe, expect, it, vi } from 'vitest';
import { UpdatePortalLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/UpdatePortalLoanApplicationUseCase';
import { UpdateLoanApplicationSelfServiceUseCase } from '@modules/loan-application/application/use-cases/UpdateLoanApplicationSelfServiceUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { PortalLoanApplicationNotFoundError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '@modules/loan-application/application/services/LoanApplicationPreQualificationService';

function buildApplication(portalAccountId: string | undefined) {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Jane Doe',
    requestedCategory: 'Personal Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
    portalAccountId,
  });
}

function buildDeps(application: LoanApplication | null) {
  const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
    findById: vi.fn().mockResolvedValue(application),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const preQualificationService: Partial<LoanApplicationPreQualificationService> = {
    classify: vi.fn().mockResolvedValue({ status: 'PREAPPROVED', distanceFromBranchKm: null }),
  };
  const updateLoanApplicationSelfServiceUseCase = new UpdateLoanApplicationSelfServiceUseCase({
    loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    preQualificationService: preQualificationService as LoanApplicationPreQualificationService,
  });
  return { loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository, updateLoanApplicationSelfServiceUseCase };
}

describe('UpdatePortalLoanApplicationUseCase', () => {
  it("updates the application when it belongs to the calling portal account", async () => {
    const application = buildApplication('acct-1');
    const deps = buildDeps(application);
    const result = await new UpdatePortalLoanApplicationUseCase(deps).execute('acct-1', application.id, { employer: 'Acme Corp' });
    expect(result.toProps().employer).toBe('Acme Corp');
  });

  it("throws PortalLoanApplicationNotFoundError when the application belongs to a DIFFERENT portal account", async () => {
    const application = buildApplication('acct-2');
    const deps = buildDeps(application);
    await expect(new UpdatePortalLoanApplicationUseCase(deps).execute('acct-1', application.id, { employer: 'Acme' })).rejects.toBeInstanceOf(
      PortalLoanApplicationNotFoundError,
    );
  });

  it('throws PortalLoanApplicationNotFoundError when the application does not exist', async () => {
    const deps = buildDeps(null);
    await expect(new UpdatePortalLoanApplicationUseCase(deps).execute('acct-1', 'missing-id', { employer: 'Acme' })).rejects.toBeInstanceOf(
      PortalLoanApplicationNotFoundError,
    );
  });

  it('throws PortalLoanApplicationNotFoundError for a staff-encoded application (no portalAccountId at all)', async () => {
    const application = buildApplication(undefined);
    const deps = buildDeps(application);
    await expect(new UpdatePortalLoanApplicationUseCase(deps).execute('acct-1', application.id, { employer: 'Acme' })).rejects.toBeInstanceOf(
      PortalLoanApplicationNotFoundError,
    );
  });
});
