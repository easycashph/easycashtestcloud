import { describe, expect, it, vi } from 'vitest';
import { UpdateProductTypeLabelUseCase } from '@modules/product-type-label/application/use-cases/UpdateProductTypeLabelUseCase';
import { ProductTypeLabel } from '@modules/product-type-label/domain/ProductTypeLabel';
import { DomainError, NotFoundError } from '@shared/errors/DomainError';

function makeLabel(overrides: Partial<Parameters<typeof ProductTypeLabel.fromRecord>[0]> = {}) {
  return ProductTypeLabel.fromRecord({
    id: 'ptl-1',
    canonicalKey: 'Business Loan',
    label: 'Business Loan',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('UpdateProductTypeLabelUseCase', () => {
  it('renames the label', async () => {
    const existing = makeLabel();
    const productTypeLabelRepository = {
      findAll: vi.fn().mockResolvedValue([existing]),
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(makeLabel({ label: 'Company Loan' })),
    };
    const useCase = new UpdateProductTypeLabelUseCase({ productTypeLabelRepository });

    const result = await useCase.execute('ptl-1', 'Company Loan');

    expect(productTypeLabelRepository.update).toHaveBeenCalledWith('ptl-1', 'Company Loan');
    expect(result.label).toBe('Company Loan');
  });

  it('rejects a blank label', async () => {
    const productTypeLabelRepository = { findAll: vi.fn(), findById: vi.fn(), update: vi.fn() };
    const useCase = new UpdateProductTypeLabelUseCase({ productTypeLabelRepository });

    await expect(useCase.execute('ptl-1', '   ')).rejects.toThrow();
    expect(productTypeLabelRepository.update).not.toHaveBeenCalled();
  });

  it('rejects a label already used by another Product Type', async () => {
    const existing = makeLabel();
    const other = makeLabel({ id: 'ptl-2', canonicalKey: 'Salary Loan', label: 'Salary Loan' });
    const productTypeLabelRepository = {
      findAll: vi.fn().mockResolvedValue([existing, other]),
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn(),
    };
    const useCase = new UpdateProductTypeLabelUseCase({ productTypeLabelRepository });

    await expect(useCase.execute('ptl-1', 'Salary Loan')).rejects.toThrow(DomainError);
    expect(productTypeLabelRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for a Product Type Label that does not exist', async () => {
    const productTypeLabelRepository = { findAll: vi.fn(), findById: vi.fn().mockResolvedValue(null), update: vi.fn() };
    const useCase = new UpdateProductTypeLabelUseCase({ productTypeLabelRepository });

    await expect(useCase.execute('missing', 'X')).rejects.toThrow(NotFoundError);
  });
});
