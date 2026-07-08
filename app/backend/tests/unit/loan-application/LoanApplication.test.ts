import { describe, expect, it } from 'vitest';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import {
  InvalidLoanApplicationTransitionError,
  ProductNotAssignedError,
} from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

function buildApplication() {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
  });
}

describe('LoanApplication', () => {
  it('starts PENDING_REVIEW / UNREVIEWED on create()', () => {
    const application = buildApplication();
    expect(application.status).toBe('PENDING_REVIEW');
    expect(application.reviewState).toBe('UNREVIEWED');
  });

  it('markReviewed() flips reviewState independently of status', () => {
    const application = buildApplication();
    application.markReviewed();
    expect(application.reviewState).toBe('REVIEWED');
    expect(application.status).toBe('PENDING_REVIEW');
  });

  it('approve() throws ProductNotAssignedError when no product sub-type is assigned', () => {
    const application = buildApplication();
    expect(() => application.approve('user-1', undefined)).toThrow(ProductNotAssignedError);
  });

  it('approve() succeeds once a product is assigned, recording the reviewer and note', () => {
    const application = buildApplication();
    application.assignProduct('version-1');
    application.approve('user-1', 'looks good');

    const props = application.toProps();
    expect(props.status).toBe('APPROVED');
    expect(props.reviewedByUserId).toBe('user-1');
    expect(props.decisionNote).toBe('looks good');
    expect(props.reviewedAt).toBeInstanceOf(Date);
  });

  it('decline() does not require a product to be assigned', () => {
    const application = buildApplication();
    application.decline('user-1', 'insufficient income');
    expect(application.status).toBe('DECLINED');
  });

  it('approve() throws InvalidLoanApplicationTransitionError when already decided', () => {
    const application = buildApplication();
    application.assignProduct('version-1');
    application.approve('user-1', undefined);
    expect(() => application.approve('user-1', undefined)).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('revert() clears the decision and returns to PENDING_REVIEW', () => {
    const application = buildApplication();
    application.assignProduct('version-1');
    application.approve('user-1', 'note');

    application.revert();

    const props = application.toProps();
    expect(props.status).toBe('PENDING_REVIEW');
    expect(props.reviewedByUserId).toBeUndefined();
    expect(props.reviewedAt).toBeUndefined();
    expect(props.decisionNote).toBeUndefined();
  });

  it('revert() throws InvalidLoanApplicationTransitionError when already PENDING_REVIEW', () => {
    const application = buildApplication();
    expect(() => application.revert()).toThrow(InvalidLoanApplicationTransitionError);
  });
});
