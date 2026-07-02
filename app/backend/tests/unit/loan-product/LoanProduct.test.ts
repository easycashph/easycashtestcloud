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

    // Read the CURRENT state through the aggregate, not the original
    // v1/v2 references — H-1's immutability fix means activateVersion()
    // replaces versions[] entries with new instances rather than mutating
    // v1/v2 in place, so the aggregate (not the stale closures) is the
    // source of truth. See the dedicated H-1 regression test below for
    // what happens to the original references themselves.
    expect(product.versions.find((v) => v.id === v1.id)?.isActive).toBe(false);
    expect(product.versions.find((v) => v.id === v2.id)?.isActive).toBe(true);
    expect(product.versions.filter((v) => v.isActive)).toHaveLength(1);
  });

  // Audit finding H-1 (Milestone 7.1 remediation): regression test for the
  // actual vulnerability — a caller holding a LoanProductVersion obtained
  // from LoanProduct.versions can no longer corrupt LPV-2, because
  // mutating methods on that class no longer exist; withActive() returns
  // a detached copy that never affects the aggregate's real state.
  describe('LoanProductVersion immutability closes the LPV-2 bypass (H-1)', () => {
    it('has no _setActive method (or any other in-place mutator) at all', () => {
      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      const v1 = buildVersion(product, 1);
      product.addVersion(v1);

      expect((v1 as unknown as Record<string, unknown>)._setActive).toBeUndefined();
    });

    it('calling withActive() on a version obtained from LoanProduct.versions does not affect the aggregate', () => {
      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      product.addVersion(buildVersion(product, 1));
      const externallyHeldVersion = product.versions[0]!;

      // Simulates the exact bypass the audit found: code outside
      // LoanProduct calling a mutation-shaped method directly.
      const detachedCopy = externallyHeldVersion.withActive(true);

      expect(detachedCopy.isActive).toBe(true); // the detached copy itself did change...
      expect(product.getActiveVersion()).toBeUndefined(); // ...but the aggregate's real state did not.
      expect(product.versions[0]?.isActive).toBe(false);
    });

    it('LoanProduct.versions returns a defensive copy — array-level tampering cannot reach the aggregate either', () => {
      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      product.addVersion(buildVersion(product, 1));

      const externalArray = product.versions as LoanProductVersion[];
      externalArray.pop();

      expect(product.versions).toHaveLength(1);
    });

    it('activateVersion() remains the only way to actually change which version is Active', () => {
      const product = LoanProduct.create({ code: 'PL-01', name: 'Personal Loan' });
      const v1 = buildVersion(product, 1);
      product.addVersion(v1);

      product.activateVersion(v1.id);

      expect(product.getActiveVersion()?.id).toBe(v1.id);
    });
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
