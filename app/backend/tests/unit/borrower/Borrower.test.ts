import { describe, expect, it } from 'vitest';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

function createBorrower() {
  return Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
}

describe('Borrower', () => {
  it('create() defaults status to ACTIVE and loanCycle to 0', () => {
    const borrower = createBorrower();
    expect(borrower.status).toBe('ACTIVE');
    expect(borrower.loanCycle).toBe(0);
    expect(borrower.id).toBeTruthy();
  });

  it('deactivate/reactivate transition status and bump updatedAt', async () => {
    const borrower = createBorrower();
    const before = borrower.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 2));

    borrower.deactivate();
    expect(borrower.status).toBe('INACTIVE');
    expect(borrower.updatedAt.getTime()).toBeGreaterThan(before.getTime());

    borrower.reactivate();
    expect(borrower.status).toBe('ACTIVE');
  });

  it('incrementLoanCycle increments by exactly 1', () => {
    const borrower = createBorrower();
    borrower.incrementLoanCycle();
    borrower.incrementLoanCycle();
    expect(borrower.loanCycle).toBe(2);
  });

  it('assignLoanOfficer sets the officer id', () => {
    const borrower = createBorrower();
    borrower.assignLoanOfficer('officer-1');
    expect(borrower.assignedLoanOfficerId).toBe('officer-1');
  });

  it('reconstitute does not re-derive defaults — it trusts the given props', () => {
    const props = {
      id: 'b-1',
      branchId: 'branch-1',
      name: PersonName.of('Juan', 'Dela Cruz'),
      status: 'INACTIVE' as const,
      loanCycle: 5,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-02'),
      identificationDocuments: [],
      characterReferences: [],
      addresses: [],
    };
    const borrower = Borrower.reconstitute(props);
    expect(borrower.status).toBe('INACTIVE');
    expect(borrower.loanCycle).toBe(5);
  });
});
