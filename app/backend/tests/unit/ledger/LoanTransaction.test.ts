import { describe, expect, it } from 'vitest';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { Money } from '@shared/domain/Money';
import { ComponentSumMismatchError } from '@modules/ledger/domain/errors/LedgerDomainErrors';

function buildInput(overrides: Partial<Parameters<typeof LoanTransaction.create>[0]> = {}) {
  return {
    loanAccountId: 'loan-1',
    type: 'REPAYMENT' as const,
    amount: Money.of('1000.00'),
    components: { principalComponent: Money.of('800.00'), interestComponent: Money.of('200.00') },
    balanceAfter: Money.of('9000.00'),
    branchId: 'branch-1',
    entryDate: new Date('2026-07-01'),
    ...overrides,
  };
}

describe('LoanTransaction (ADR-042 §6: independent, append-only aggregate)', () => {
  it('create() succeeds when components sum to amount', () => {
    const txn = LoanTransaction.create(buildInput());
    expect(txn.amount.equals(Money.of('1000.00'))).toBe(true);
    expect(txn.components.principalComponent.equals(Money.of('800.00'))).toBe(true);
  });

  it('throws ComponentSumMismatchError when components do not sum to amount (TXN-2)', () => {
    expect(() =>
      LoanTransaction.create(
        buildInput({ components: { principalComponent: Money.of('700.00'), interestComponent: Money.of('200.00') } }),
      ),
    ).toThrow(ComponentSumMismatchError);
  });

  it('defaults unspecified components to zero and still validates the sum', () => {
    const txn = LoanTransaction.create(buildInput({ amount: Money.of('500.00'), components: { feesComponent: Money.of('500.00') } }));
    expect(txn.components.principalComponent.isZero()).toBe(true);
    expect(txn.components.feesComponent.equals(Money.of('500.00'))).toBe(true);
  });

  it('has no mutation methods — TypeScript exposes only getters', () => {
    const txn = LoanTransaction.create(buildInput());
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(txn)).filter((name) => name !== 'constructor');
    // Every exposed member is a getter (accessor), never a plain mutating method.
    const descriptors = methodNames.map((name) => Object.getOwnPropertyDescriptor(Object.getPrototypeOf(txn), name));
    expect(descriptors.every((d) => typeof d?.get === 'function')).toBe(true);
  });

  it('a reversal is a NEW transaction referencing the original, never an edit of it', () => {
    const original = LoanTransaction.create(buildInput());
    const reversal = LoanTransaction.create(
      buildInput({
        type: 'REVERSAL',
        reversesTransactionId: original.id,
        components: { principalComponent: Money.of('-800.00'), interestComponent: Money.of('-200.00') },
        amount: Money.of('-1000.00'),
      }),
    );
    expect(reversal.id).not.toBe(original.id);
    expect(reversal.reversesTransactionId).toBe(original.id);
  });
});
