import { describe, expect, it, vi } from 'vitest';
import { SubmitLoanApplicationUseCase } from '@modules/client-portal/application/use-cases/SubmitLoanApplicationUseCase';
import { CreateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/CreateLoanApplicationUseCase';
import { PortalAccountNotFoundError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { IPortalAccountRepository, PortalAccountRecord } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '@modules/loan-application/application/services/LoanApplicationPreQualificationService';

const ACCOUNT: PortalAccountRecord = {
  id: 'acct-1',
  email: 'client@example.com',
  passwordHash: 'hash',
  contactNumber: '09171234567',
  status: 'ACTIVE',
  emailVerifiedAt: new Date(),
  borrowerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildDeps(account: PortalAccountRecord | null) {
  const portalAccountRepository: IPortalAccountRepository = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(account),
    update: vi.fn(),
  };
  const loanApplicationRepository: Partial<ILoanApplicationRepository> = {
    findByBorrowerId: vi.fn().mockResolvedValue([]),
    findByPortalAccountId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const preQualificationService: Partial<LoanApplicationPreQualificationService> = {
    classify: vi.fn().mockResolvedValue({ status: 'PREAPPROVED', distanceFromBranchKm: 1.2 }),
  };
  const createLoanApplicationUseCase = new CreateLoanApplicationUseCase({
    loanApplicationRepository: loanApplicationRepository as ILoanApplicationRepository,
    preQualificationService: preQualificationService as LoanApplicationPreQualificationService,
  });
  return { portalAccountRepository, createLoanApplicationUseCase, loanApplicationRepository };
}

describe('SubmitLoanApplicationUseCase', () => {
  const input = {
    branchId: 'branch-1',
    applicantName: 'Jane Doe',
    requestedCategory: 'Personal Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
  };

  it('creates a LoanApplication tagged with the submitting portalAccountId, filling in blank contact fields from the account', async () => {
    const deps = buildDeps(ACCOUNT);
    const application = await new SubmitLoanApplicationUseCase(deps).execute(ACCOUNT.id, input);

    expect(application.toProps().portalAccountId).toBe(ACCOUNT.id);
    expect(application.toProps().email).toBe(ACCOUNT.email);
    expect(application.toProps().mobilePhone).toBe(ACCOUNT.contactNumber);
    expect(deps.loanApplicationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('does not override an applicant-provided email/mobile with the account defaults', async () => {
    const deps = buildDeps(ACCOUNT);
    const application = await new SubmitLoanApplicationUseCase(deps).execute(ACCOUNT.id, {
      ...input,
      email: 'other@example.com',
      mobilePhone: '09990001111',
    });

    expect(application.toProps().email).toBe('other@example.com');
    expect(application.toProps().mobilePhone).toBe('09990001111');
  });

  it('throws PortalAccountNotFoundError when the portal account no longer exists', async () => {
    const deps = buildDeps(null);
    await expect(new SubmitLoanApplicationUseCase(deps).execute('missing-acct', input)).rejects.toBeInstanceOf(
      PortalAccountNotFoundError,
    );
    expect(deps.loanApplicationRepository.save).not.toHaveBeenCalled();
  });

  it('links borrowerId onto the application when the account is already linked to a Borrower', async () => {
    const deps = buildDeps({ ...ACCOUNT, borrowerId: 'borrower-9' });
    const application = await new SubmitLoanApplicationUseCase(deps).execute(ACCOUNT.id, input);
    expect(application.toProps().borrowerId).toBe('borrower-9');
  });
});
