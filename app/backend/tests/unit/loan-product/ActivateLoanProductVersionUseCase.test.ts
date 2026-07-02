import { describe, expect, it, vi } from 'vitest';
import { ActivateLoanProductVersionUseCase } from '@modules/loan-product/application/use-cases/ActivateLoanProductVersionUseCase';
import { LoanProduct } from '@modules/loan-product/domain/LoanProduct';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { Money } from '@shared/domain/Money';
import { NotFoundError } from '@shared/errors/DomainError';

describe('ActivateLoanProductVersionUseCase', () => {
  it('activates the target version and saves the whole product graph', async () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const version = LoanProductVersion.create({
      loanProductId: product.id,
      versionNumber: 1,
      effectiveFrom: new Date(),
      interestCalculationMethod: 'FLAT',
      loanAmountMin: Money.of('1000.00'),
      installmentCountMin: 6,
    });
    product.addVersion(version);

    const loanProductRepository = { findById: vi.fn().mockResolvedValue(product), findByCode: vi.fn(), save: vi.fn() };
    const useCase = new ActivateLoanProductVersionUseCase({ loanProductRepository });

    await useCase.execute(product.id, version.id);

    // Read through the aggregate, not the original `version` reference —
    // H-1's immutability fix means activateVersion() replaces the
    // versions[] entry with a new instance rather than mutating `version`
    // in place (see LoanProduct.test.ts's dedicated H-1 regression tests
    // for why that's the point of the fix).
    expect(product.getActiveVersion()?.id).toBe(version.id);
    expect(loanProductRepository.save).toHaveBeenCalledWith(product);
  });

  it('throws NotFoundError for an unknown product id', async () => {
    const loanProductRepository = { findById: vi.fn().mockResolvedValue(null), findByCode: vi.fn(), save: vi.fn() };
    const useCase = new ActivateLoanProductVersionUseCase({ loanProductRepository });

    await expect(useCase.execute('missing', 'v-1')).rejects.toThrow(NotFoundError);
  });
});
