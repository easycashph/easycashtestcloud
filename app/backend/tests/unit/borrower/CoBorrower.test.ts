import { describe, expect, it } from 'vitest';
import { CoBorrower } from '@modules/borrower/domain/CoBorrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

describe('CoBorrower (ADR-042 §3: independent aggregate, not a child of Borrower or LoanAccount)', () => {
  it('create() assigns its own identity, independent of any LoanAccount', () => {
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos'), relationship: 'Spouse' });
    expect(coBorrower.id).toBeTruthy();
    expect(coBorrower.relationship).toBe('Spouse');
  });

  it('has no loanAccountId field — attachment to a loan is a join-table concern owned by loan-account', () => {
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });
    expect((coBorrower as unknown as Record<string, unknown>).loanAccountId).toBeUndefined();
  });
});
