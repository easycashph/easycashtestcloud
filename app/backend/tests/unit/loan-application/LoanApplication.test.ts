import { describe, expect, it } from 'vitest';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import {
  InvalidLoanApplicationTransitionError,
  ProductNotAssignedError,
} from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

/**
 * 2026-07-17: rewritten against the current domain model (Under Review / Pre Approval pipeline,
 * 2026-07-16) - this file previously tested a superseded shape (`status` defaulting to
 * 'PENDING_REVIEW', a separate `reviewState`/`markReviewed()`, zero-arg `revert()`) that no longer
 * exists on `LoanApplication`. `status` is now required at `create()` time (system-computed
 * PREAPPROVED/PREDECLINED - see `LoanApplicationPreQualificationService`), `approve()` only
 * succeeds from PRE_APPROVAL, and `revert(targetStatus)` takes the freshly-recomputed system
 * verdict as an argument (see `RevertLoanApplicationDecisionUseCase`, which is what actually
 * computes it in production).
 */
function buildApplication(status: 'PREAPPROVED' | 'PREDECLINED' | 'PRE_APPROVAL' = 'PREAPPROVED') {
  const application = LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    status: status === 'PRE_APPROVAL' ? 'PREAPPROVED' : status,
  });
  if (status === 'PRE_APPROVAL') {
    application.startReview('reviewer-1');
    application.tagPreApproval('reviewer-1');
  }
  return application;
}

describe('LoanApplication', () => {
  it('starts at the system-computed status passed to create()', () => {
    const preapproved = buildApplication('PREAPPROVED');
    expect(preapproved.status).toBe('PREAPPROVED');

    const predeclined = buildApplication('PREDECLINED');
    expect(predeclined.status).toBe('PREDECLINED');
  });

  it('startReview() moves PREAPPROVED to UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    expect(application.status).toBe('UNDER_REVIEW');
  });

  it('tagPreApproval() moves UNDER_REVIEW to PRE_APPROVAL', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('reviewer-1');
    application.tagPreApproval('reviewer-1');
    expect(application.status).toBe('PRE_APPROVAL');
  });

  it('approve() throws InvalidLoanApplicationTransitionError when not yet PRE_APPROVAL', () => {
    const application = buildApplication('PREAPPROVED');
    expect(() => application.approve('user-1', undefined)).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('approve() throws ProductNotAssignedError when no product sub-type is assigned', () => {
    const application = buildApplication('PRE_APPROVAL');
    expect(() => application.approve('user-1', undefined)).toThrow(ProductNotAssignedError);
  });

  it('approve() succeeds once a product is assigned, recording the reviewer and note', () => {
    const application = buildApplication('PRE_APPROVAL');
    application.assignProduct('version-1');
    application.approve('user-1', 'looks good');

    const props = application.toProps();
    expect(props.status).toBe('APPROVED');
    expect(props.reviewedByUserId).toBe('user-1');
    expect(props.decisionNote).toBe('looks good');
    expect(props.reviewedAt).toBeInstanceOf(Date);
  });

  it('decline() succeeds from PREAPPROVED without requiring a product to be assigned', () => {
    const application = buildApplication('PREAPPROVED');
    application.decline('user-1', 'insufficient income');
    expect(application.status).toBe('DECLINED');
  });

  it('approve() throws InvalidLoanApplicationTransitionError when already decided', () => {
    const application = buildApplication('PRE_APPROVAL');
    application.assignProduct('version-1');
    application.approve('user-1', undefined);
    expect(() => application.approve('user-1', undefined)).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('revert() clears the decision and applies the given target status', () => {
    const application = buildApplication('PRE_APPROVAL');
    application.assignProduct('version-1');
    application.approve('user-1', 'note');

    application.revert('PREDECLINED');

    const props = application.toProps();
    expect(props.status).toBe('PREDECLINED');
    expect(props.reviewedByUserId).toBeUndefined();
    expect(props.reviewedAt).toBeUndefined();
    expect(props.decisionNote).toBeUndefined();
  });

  it('revert() throws InvalidLoanApplicationTransitionError when still PREAPPROVED/PREDECLINED', () => {
    const application = buildApplication('PREAPPROVED');
    expect(() => application.revert('PREDECLINED')).toThrow(InvalidLoanApplicationTransitionError);
  });
});
