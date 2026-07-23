import { describe, expect, it, vi } from 'vitest';
import { UpdateLoanAccountUseCase } from '@modules/loan-account/application/use-cases/UpdateLoanAccountUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { ConcurrencyConflictError, NotFoundError } from '@shared/errors/DomainError';
import {
  InstallmentCountOutOfRangeError,
  LoanAccountNotEditableError,
  LoanAmountOutOfRangeError,
} from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';

function buildVersion(overrides: Partial<{ loanAmountMin: string; loanAmountMax?: string; installmentCountMin: number; installmentCountMax?: number }> = {}) {
  return LoanProductVersion.create({
    loanProductId: 'product-1',
    versionNumber: 1,
    effectiveFrom: new Date(),
    interestCalculationMethod: 'FLAT',
    loanAmountMin: Money.of(overrides.loanAmountMin ?? '1000.00'),
    loanAmountMax: overrides.loanAmountMax ? Money.of(overrides.loanAmountMax) : undefined,
    installmentCountMin: overrides.installmentCountMin ?? 6,
    installmentCountMax: overrides.installmentCountMax,
  });
}

function buildPendingLoan(overrides: Partial<{ loanProductVersionId: string; principalAmount: string; installmentCount: number }> = {}) {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: overrides.loanProductVersionId ?? 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of(overrides.principalAmount ?? '10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: overrides.installmentCount ?? 12,
    firstRepaymentDate: new Date('2026-08-15'),
  });
}

function buildRepos(version: LoanProductVersion | null, loan?: LoanAccount) {
  const loanAccountRepository = {
    findById: vi.fn().mockResolvedValue(loan ?? null),
    findByLoanCode: vi.fn(),
    save: vi.fn(),
    findMaxLoanCodeSequenceForPrefix: vi.fn(),
  } as unknown as ILoanAccountRepository;
  const loanProductRepository = {
    findById: vi.fn(),
    findByCode: vi.fn(),
    findMany: vi.fn(),
    findVersionById: vi.fn().mockResolvedValue(version),
    save: vi.fn(),
  };
  return { loanAccountRepository, loanProductRepository };
}

describe('UpdateLoanAccountUseCase (2026-07-16, Edit Loan Account)', () => {
  it('throws NotFoundError when the loan account does not exist', async () => {
    const { loanAccountRepository, loanProductRepository } = buildRepos(buildVersion(), undefined);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(useCase.execute('missing-loan', { principalAmount: '20000.00' })).rejects.toThrow(NotFoundError);
    expect(loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('applies a partial edit and saves the mutated aggregate', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
    const loan = buildPendingLoan();
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    const result = await useCase.execute(loan.id, { principalAmount: '15000.00', installmentCount: 6 });

    expect(result.principalAmount.equals(Money.of('15000.00'))).toBe(true);
    expect(result.installmentCount).toBe(6);
    expect(loanAccountRepository.save).toHaveBeenCalledWith(loan);
  });

  it('re-validates principal against the CURRENT (or newly-selected) product version even when principalAmount itself was not edited', async () => {
    // Loan's principal (10000) is within version-1's range but NOT within version-2's tighter range.
    const version2 = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '5000.00', installmentCountMin: 6, installmentCountMax: 24 });
    const loan = buildPendingLoan({ loanProductVersionId: 'version-1', principalAmount: '10000.00' });
    const { loanAccountRepository, loanProductRepository } = buildRepos(version2, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(useCase.execute(loan.id, { loanProductVersionId: 'version-2' })).rejects.toThrow(LoanAmountOutOfRangeError);
    expect(loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an edited installmentCount outside the product version range', async () => {
    const version = buildVersion({ installmentCountMin: 6, installmentCountMax: 12 });
    const loan = buildPendingLoan();
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(useCase.execute(loan.id, { installmentCount: 36 })).rejects.toThrow(InstallmentCountOutOfRangeError);
  });

  it('propagates LoanAccountNotEditableError once the loan is past PENDING_APPROVAL', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00' });
    const loan = buildPendingLoan();
    loan.approve('officer-1');
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(useCase.execute(loan.id, { principalAmount: '20000.00' })).rejects.toThrow(LoanAccountNotEditableError);
    expect(loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('merges one supplied fee onto the existing originationFees rather than zeroing the other eight', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00' });
    const loan = LoanAccount.create({
      loanCode: 'LN-0001',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: Money.of('10000.00'),
      interestRate: Percentage.of('2.5'),
      installmentCount: 12,
      firstRepaymentDate: new Date('2026-08-15'),
      originationFees: {
        processingFee: Money.of('300.00'),
        advanceInterestFee: Money.ZERO,
        outstandingBalancePayoff: Money.ZERO,
        docStampFee: Money.ZERO,
        accountManagementFee: Money.ZERO,
        otherFees: Money.ZERO,
        notarialFee: Money.of('500.00'),
        webFee: Money.ZERO,
        insuranceFee: Money.ZERO,
      },
    });
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    const result = await useCase.execute(loan.id, { processingFee: '1000.00' });

    expect(result.originationFees.processingFee.equals(Money.of('1000.00'))).toBe(true);
    expect(result.originationFees.notarialFee.equals(Money.of('500.00'))).toBe(true);
    // 10000 - (1000 processing + 500 notarial) = 8500
    expect(result.netProceeds.equals(Money.of('8500.00'))).toBe(true);
  });

  it('rejects with ConcurrencyConflictError when expectedVersion does not match the loaded aggregate (2026-07-22)', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00' });
    const loan = buildPendingLoan();
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(useCase.execute(loan.id, { principalAmount: '20000.00', expectedVersion: loan.version + 1 })).rejects.toThrow(
      ConcurrencyConflictError,
    );
    expect(loanAccountRepository.save).not.toHaveBeenCalled();
  });

  it('applies the edit when expectedVersion matches the loaded aggregate', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00' });
    const loan = buildPendingLoan();
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    const result = await useCase.execute(loan.id, { principalAmount: '20000.00', expectedVersion: loan.version });

    expect(result.principalAmount.equals(Money.of('20000.00'))).toBe(true);
    expect(loanAccountRepository.save).toHaveBeenCalledWith(loan);
  });

  it('leaves originationFees/netProceeds untouched when no fee field was supplied', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00' });
    const loan = buildPendingLoan();
    const before = loan.netProceeds;
    const { loanAccountRepository, loanProductRepository } = buildRepos(version, loan);
    const useCase = new UpdateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    const result = await useCase.execute(loan.id, { gracePeriodDays: 5 });

    expect(result.netProceeds.equals(before)).toBe(true);
  });
});
