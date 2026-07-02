import { describe, expect, it } from 'vitest';
import { LoanProduct } from '@modules/loan-product/domain/LoanProduct';
import { LoanProductVersion } from '@modules/loan-product/domain/LoanProductVersion';
import { Money } from '@shared/domain/Money';
import { DuplicateVersionNumberError, InvalidVersionActivationError } from '@modules/loan-product/domain/errors/LoanProductDomainErrors';

function buildVersion(product: LoanProduct, versionNumber: number) {
  return LoanProductVersion.create({
    loanProductId: product.id,
    versionNumber,
    effectiveFrom: new Date('2026-01-01'),
    interestCalculationMethod: 'FLAT',
    loanAmountMin: Money.of('1000.00'),
    installmentCountMin: 6,
  });
}

describe('LoanProduct — LPV-2 enforcement (ADR-042 §4)', () => {
  it('a newly-added version starts INACTIVE', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const v1 = buildVersion(product, 1);
    product.addVersion(v1);
    expect(v1.isActive).toBe(false);
    expect(product.getActiveVersion()).toBeUndefined();
  });

  it('activateVersion activates exactly one version', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const v1 = buildVersion(product, 1);
    product.addVersion(v1);

    product.activateVersion(v1.id);

    expect(product.getActiveVersion()?.id).toBe(v1.id);
  });

  it('activating a second version deactivates the first — never two Active at once', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const v1 = buildVersion(product, 1);
    const v2 = buildVersion(product, 2);
    product.addVersion(v1);
    product.addVersion(v2);
    product.activateVersion(v1.id);

    product.activateVersion(v2.id);

    expect(v1.isActive).toBe(false);
    expect(v2.isActive).toBe(true);
    expect(product.versions.filter((v) => v.isActive)).toHaveLength(1);
  });

  it('activating an already-active version is a harmless no-op', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const v1 = buildVersion(product, 1);
    product.addVersion(v1);
    product.activateVersion(v1.id);

    expect(() => product.activateVersion(v1.id)).not.toThrow();
    expect(product.versions.filter((v) => v.isActive)).toHaveLength(1);
  });

  it('throws for a version id that does not belong to this product', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    expect(() => product.activateVersion('nonexistent-id')).toThrow(InvalidVersionActivationError);
  });

  it('rejects a duplicate version number within the same product', () => {
    const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    product.addVersion(buildVersion(product, 1));
    expect(() => product.addVersion(buildVersion(product, 1))).toThrow(DuplicateVersionNumberError);
  });

  it('rejects a version belonging to a different product', () => {
    const productA = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
    const productB = LoanProduct.create({ code: 'PL-02', name: 'Salary Loan' });
    const foreignVersion = buildVersion(productB, 1);
    expect(() => productA.addVersion(foreignVersion)).toThrow(InvalidVersionActivationError);
  });
});
