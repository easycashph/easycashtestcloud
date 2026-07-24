import { describe, expect, it, vi } from 'vitest';
import { CreateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/CreateLoanApplicationUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { BorrowerHasInFlightLoanError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '@modules/loan-application/application/services/LoanApplicationPreQualificationService';

const INPUT = {
  branchId: 'branch-1',
  applicantName: 'Jane Doe',
  requestedCategory: 'Personal Loan',
  requestedAmount: 50000,
  requestedTermMonths: 12,
};

function buildDeps(existingApplications: LoanApplication[]) {
  const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
    findByBorrowerId: vi.fn().mockResolvedValue([]),
    findByPortalAccountId: vi.fn().mockResolvedValue(existingApplications),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const preQualificationService: Partial<LoanApplicationPreQualificationService> = {
    classify: vi.fn().mockResolvedValue({ status: 'PREAPPROVED', distanceFromBranchKm: 1.2 }),
  };
  return {
    loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    preQualificationService: preQualificationService as LoanApplicationPreQualificationService,
  };
}

function buildApplication(status: LoanApplication['status']) {
  return LoanApplication.create({ ...INPUT, portalAccountId: 'acct-1', status: status === 'PREAPPROVED' ? 'PREAPPROVED' : 'PREDECLINED' });
}

describe('CreateLoanApplicationUseCase - one-application-per-portal-account rule', () => {
  it('allows a first-ever submission for a portal account with no prior applications', async () => {
    const deps = buildDeps([]);
    const application = await new CreateLoanApplicationUseCase(deps).execute({ ...INPUT, portalAccountId: 'acct-1' });
    expect(application.toProps().portalAccountId).toBe('acct-1');
    expect(deps.loanApplicationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a new submission while a prior application for the same portal account is not yet DECLINED', async () => {
    const deps = buildDeps([buildApplication('PREAPPROVED')]);
    await expect(new CreateLoanApplicationUseCase(deps).execute({ ...INPUT, portalAccountId: 'acct-1' })).rejects.toBeInstanceOf(
      BorrowerHasInFlightLoanError,
    );
    expect(deps.loanApplicationRepository.save).not.toHaveBeenCalled();
  });

  it('allows re-submission once every prior application for this portal account is DECLINED', async () => {
    const declined = LoanApplication.create({ ...INPUT, portalAccountId: 'acct-1', status: 'PREDECLINED' });
    // Simulate a human decline (PREDECLINED -> ... -> DECLINED) by reconstituting with DECLINED status.
    const declinedProps = declined.toProps();
    const trulyDeclined = LoanApplication.reconstitute({ ...declinedProps, status: 'DECLINED' });
    const deps = buildDeps([trulyDeclined]);
    const application = await new CreateLoanApplicationUseCase(deps).execute({ ...INPUT, portalAccountId: 'acct-1' });
    expect(application.toProps().portalAccountId).toBe('acct-1');
  });

  it('does not run the portal-account check at all when borrowerId is set (borrowerId branch takes over)', async () => {
    const deps = buildDeps([buildApplication('PREAPPROVED')]);
    (deps.loanApplicationRepository.findByBorrowerId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const application = await new CreateLoanApplicationUseCase(deps).execute({ ...INPUT, borrowerId: 'borrower-1', portalAccountId: 'acct-1' });
    expect(application.toProps().borrowerId).toBe('borrower-1');
    expect(deps.loanApplicationRepository.findByPortalAccountId).not.toHaveBeenCalled();
  });
});
