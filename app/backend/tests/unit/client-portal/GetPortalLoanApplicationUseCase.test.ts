import { describe, expect, it, vi } from 'vitest';
import { GetPortalLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/GetPortalLoanApplicationUseCase';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { PortalLoanApplicationNotFoundError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';

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

describe('GetPortalLoanApplicationUseCase', () => {
  it('returns the application when it belongs to the calling portal account', async () => {
    const application = buildApplication('acct-1');
    const loanApplicationRepository: Partial<ILoanApplicationRepository> = { findById: vi.fn().mockResolvedValue(application) };
    const result = await new GetPortalLoanApplicationUseCase({ loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository }).execute(
      'acct-1',
      application.id,
    );
    expect(result.id).toBe(application.id);
  });

  it('throws PortalLoanApplicationNotFoundError for a different account', async () => {
    const application = buildApplication('acct-2');
    const loanApplicationRepository: Partial<ILoanApplicationRepository> = { findById: vi.fn().mockResolvedValue(application) };
    await expect(
      new GetPortalLoanApplicationUseCase({ loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository }).execute(
        'acct-1',
        application.id,
      ),
    ).rejects.toBeInstanceOf(PortalLoanApplicationNotFoundError);
  });
});
