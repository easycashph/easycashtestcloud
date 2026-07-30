import { describe, expect, it, vi } from 'vitest';
import { ListPortalLoanApplicationsUseCase } from '@modules/client-portal/application/use-cases/ListPortalLoanApplicationsUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';

function buildApplication(overrides: Partial<Parameters<typeof LoanApplication.create>[0]> = {}) {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Jane Doe',
    requestedCategory: 'Personal Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: 'PREAPPROVED',
    portalAccountId: 'acct-1',
    ...overrides,
  });
}

describe('ListPortalLoanApplicationsUseCase', () => {
  it('returns a status summary for every application the portal account submitted', async () => {
    const applications = [buildApplication(), buildApplication({ requestedCategory: 'SME Loan', requestedAmount: 100000 })];
    const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
      findByPortalAccountId: vi.fn().mockResolvedValue(applications),
    };

    const result = await new ListPortalLoanApplicationsUseCase({
      loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    }).execute('acct-1');

    expect(loanApplicationRepository.findByPortalAccountId).toHaveBeenCalledWith('acct-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ branchId: 'branch-1', status: 'PREAPPROVED', requestedCategory: 'Personal Loan', requestedAmount: 50000 });
    expect(result[1]).toMatchObject({ requestedCategory: 'SME Loan', requestedAmount: 100000 });
  });

  it('returns an empty array when the account has never submitted an application', async () => {
    const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
      findByPortalAccountId: vi.fn().mockResolvedValue([]),
    };
    const result = await new ListPortalLoanApplicationsUseCase({
      loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    }).execute('acct-1');
    expect(result).toEqual([]);
  });
});
