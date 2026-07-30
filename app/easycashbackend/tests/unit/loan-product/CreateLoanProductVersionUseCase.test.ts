import { describe, expect, it, vi } from 'vitest';
import { CreateLoanProductVersionUseCase } from '@modules/loan-product/application/use-cases/CreateLoanProductVersionUseCase';
import { LoanProduct } from '@modules/loan-product/domain/LoanProduct';
import { NotFoundError } from '@shared/errors/DomainError';

describe('CreateLoanProductVersionUseCase', () => {
  it('creates a new INACTIVE version and appends it to the product', async () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const loanProductRepository = { findById: vi.fn().mockResolvedValue(product), findByCode: vi.fn(), save: vi.fn() };
    const useCase = new CreateLoanProductVersionUseCase({ loanProductRepository });

    const version = await useCase.execute({
      loanProductId: product.id,
      versionNumber: 1,
      effectiveFrom: new Date(),
      interestCalculationMethod: 'DECLINING_BALANCE',
      loanAmountMin: '5000.00',
      installmentCountMin: 12,
      defaultInterestRate: '2.5',
    });

    expect(version.isActive).toBe(false);
    expect(product.versions).toContain(version);
    expect(loanProductRepository.save).toHaveBeenCalledWith(product);
  });

  it('throws NotFoundError for an unknown product id', async () => {
    const loanProductRepository = { findById: vi.fn().mockResolvedValue(null), findByCode: vi.fn(), save: vi.fn() };
    const useCase = new CreateLoanProductVersionUseCase({ loanProductRepository });

    await expect(
      useCase.execute({
        loanProductId: 'missing',
        versionNumber: 1,
        effectiveFrom: new Date(),
        interestCalculationMethod: 'FLAT',
        loanAmountMin: '1000.00',
        installmentCountMin: 6,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
