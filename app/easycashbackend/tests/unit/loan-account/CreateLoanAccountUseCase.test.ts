import { describe, expect, it, vi } from 'vitest';
import { CreateLoanAccountUseCase } from '@modules/loan-account/application/use-cases/CreateLoanAccountUseCase';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { Money } from '@shared/domain/Money';
import { NotFoundError } from '@shared/errors/DomainError';
import { InstallmentCountOutOfRangeError, LoanAmountOutOfRangeError } from '@modules/loan-account/domain/errors/LoanAccountDomainErrors';

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

function buildRepos(version: LoanProductVersion | null) {
  const loanAccountRepository = {
    findById: vi.fn(),
    findByLoanCode: vi.fn(),
    save: vi.fn(),
    findMaxLoanCodeSequenceForPrefix: vi.fn().mockResolvedValue(0),
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

describe('CreateLoanAccountUseCase', () => {
  it('creates a PENDING_APPROVAL loan account when principal/installmentCount fall within the product version range', async () => {
    const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
    const { loanAccountRepository, loanProductRepository } = buildRepos(version);
    const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    const loan = await useCase.execute({
      loanCode: 'LN-0001',
      borrowerId: 'borrower-1',
      loanProductVersionId: version.id,
      branchId: 'branch-1',
      principalAmount: '10000.00',
      interestRate: '2.5',
      installmentCount: 12,
      firstRepaymentDate: new Date('2026-08-15'),
    });

    expect(loan.status).toBe('PENDING_APPROVAL');
    expect(loanAccountRepository.save).toHaveBeenCalledWith(loan);
  });

  it('throws NotFoundError when the referenced LoanProductVersion does not exist', async () => {
    const { loanAccountRepository, loanProductRepository } = buildRepos(null);
    const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

    await expect(
      useCase.execute({
        loanCode: 'LN-0001',
        borrowerId: 'borrower-1',
        loanProductVersionId: 'missing-version',
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
      }),
    ).rejects.toThrow(NotFoundError);
    expect(loanAccountRepository.save).not.toHaveBeenCalled();
  });

  describe('D-3: range validation against the LoanProductVersion (configuration check, not calculation)', () => {
    it('rejects a principal below loanAmountMin', async () => {
      const version = buildVersion({ loanAmountMin: '5000.00' });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '1000.00',
          interestRate: '2.5',
          installmentCount: 6,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).rejects.toThrow(LoanAmountOutOfRangeError);
      expect(loanAccountRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a principal above loanAmountMax', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '10000.00' });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '20000.00',
          interestRate: '2.5',
          installmentCount: 6,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).rejects.toThrow(LoanAmountOutOfRangeError);
    });

    it('accepts a principal at exactly loanAmountMin or loanAmountMax (boundary inclusive)', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '10000.00' });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '1000.00',
          interestRate: '2.5',
          installmentCount: 6,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).resolves.toBeDefined();
    });

    it('allows any principal at or above loanAmountMin when loanAmountMax is not configured', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00' });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '999999.00',
          interestRate: '2.5',
          installmentCount: 6,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).resolves.toBeDefined();
    });

    it('rejects an installmentCount below installmentCountMin', async () => {
      const version = buildVersion({ installmentCountMin: 6 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '1000.00',
          interestRate: '2.5',
          installmentCount: 3,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).rejects.toThrow(InstallmentCountOutOfRangeError);
    });

    it('rejects an installmentCount above installmentCountMax', async () => {
      const version = buildVersion({ installmentCountMin: 6, installmentCountMax: 12 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      await expect(
        useCase.execute({
          loanCode: 'LN-0001',
          borrowerId: 'borrower-1',
          loanProductVersionId: version.id,
          branchId: 'branch-1',
          principalAmount: '1000.00',
          interestRate: '2.5',
          installmentCount: 36,
          firstRepaymentDate: new Date('2026-08-15'),
        }),
      ).rejects.toThrow(InstallmentCountOutOfRangeError);
    });
  });

  describe('2026-07-11: auto-generated loanCode when omitted', () => {
    it('generates {product.code}_00001 when no loan account exists yet for that product', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      (loanProductRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ code: 'SML-REG' });
      (loanAccountRepository.findMaxLoanCodeSequenceForPrefix as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      const loan = await useCase.execute({
        borrowerId: 'borrower-1',
        loanProductVersionId: version.id,
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
      });

      expect(loan.loanCode).toBe('SML-REG_00001');
      expect(loanAccountRepository.findMaxLoanCodeSequenceForPrefix).toHaveBeenCalledWith('SML-REG');
    });

    it('increments past the highest existing sequence for that product prefix', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      (loanProductRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ code: 'BL-REG' });
      (loanAccountRepository.findMaxLoanCodeSequenceForPrefix as ReturnType<typeof vi.fn>).mockResolvedValue(59);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      const loan = await useCase.execute({
        borrowerId: 'borrower-1',
        loanProductVersionId: version.id,
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
      });

      expect(loan.loanCode).toBe('BL-REG_00060');
    });

    it('respects an explicitly-supplied loanCode instead of generating one', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      const loan = await useCase.execute({
        loanCode: 'CUSTOM-CODE-1',
        borrowerId: 'borrower-1',
        loanProductVersionId: version.id,
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
      });

      expect(loan.loanCode).toBe('CUSTOM-CODE-1');
      expect(loanProductRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('2026-07-11: origination fees / netProceeds', () => {
    it('defaults every fee to zero and netProceeds to the full principal when none are supplied', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      const loan = await useCase.execute({
        loanCode: 'LN-0001',
        borrowerId: 'borrower-1',
        loanProductVersionId: version.id,
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
      });

      expect(loan.originationFees.accountManagementFee.toString()).toBe('0.00');
      expect(loan.netProceeds.toString()).toBe('10000.00');
    });

    it('computes netProceeds as principal minus the sum of all nine fee fields', async () => {
      const version = buildVersion({ loanAmountMin: '1000.00', loanAmountMax: '50000.00', installmentCountMin: 6, installmentCountMax: 24 });
      const { loanAccountRepository, loanProductRepository } = buildRepos(version);
      const useCase = new CreateLoanAccountUseCase({ loanAccountRepository, loanProductRepository });

      const loan = await useCase.execute({
        loanCode: 'LN-0001',
        borrowerId: 'borrower-1',
        loanProductVersionId: version.id,
        branchId: 'branch-1',
        principalAmount: '10000.00',
        interestRate: '2.5',
        installmentCount: 12,
        firstRepaymentDate: new Date('2026-08-15'),
        processingFee: '300.00',
        advanceInterestFee: '50.00',
        outstandingBalancePayoff: '0.00',
        docStampFee: '0.00',
        accountManagementFee: '100.00',
        otherFees: '0.00',
        notarialFee: '500.00',
        webFee: '500.00',
        insuranceFee: '50.00',
      });

      // 10000 - (300+50+0+0+100+0+500+500+50) = 10000 - 1500 = 8500
      expect(loan.originationFees.processingFee.toString()).toBe('300.00');
      expect(loan.netProceeds.toString()).toBe('8500.00');
    });
  });
});
