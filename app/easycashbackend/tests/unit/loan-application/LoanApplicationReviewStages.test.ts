import { describe, expect, it } from 'vitest';
import { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import { InvalidLoanApplicationTransitionError } from '@modules/loan-application/domain/errors/LoanApplicationDomainErrors';

function buildApplication(status: 'PREAPPROVED' | 'PREDECLINED' = 'PREAPPROVED') {
  return LoanApplication.create({
    branchId: 'branch-1',
    applicantName: 'Juan Dela Cruz',
    requestedCategory: 'Salary Loan',
    requestedAmount: 50000,
    requestedTermMonths: 12,
    submittedDocuments: ['Valid ID', 'Proof of Billing'],
    status,
  });
}

describe('LoanApplication - Under Review / Pre Approval stages', () => {
  it('startReview() moves PREAPPROVED to UNDER_REVIEW and records the starter', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');

    const props = application.toProps();
    expect(props.status).toBe('UNDER_REVIEW');
    expect(props.reviewStartedByUserId).toBe('user-1');
    expect(props.reviewStartedAt).toBeInstanceOf(Date);
  });

  it('startReview() moves PREDECLINED to UNDER_REVIEW too (2026-08-12: PREDECLINED is an advisory system verdict, not a block on human review)', () => {
    const application = buildApplication('PREDECLINED');
    application.startReview('user-1');

    const props = application.toProps();
    expect(props.status).toBe('UNDER_REVIEW');
    expect(props.reviewStartedByUserId).toBe('user-1');
  });

  it('startReview() throws once already UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    expect(() => application.startReview('user-2')).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('updateReviewReport() throws outside UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    expect(() => application.updateReviewReport({ ciNotes: 'looks fine' })).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('updateReviewReport() merges partial patches without clobbering prior fields', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');

    application.updateReviewReport({ ciNotes: 'visited residence' });
    application.updateReviewReport({ creditBureauResult: 'CLEAR', creditBureauScore: '720' });
    application.updateReviewReport({ checkedDocuments: ['Valid ID'] });

    expect(application.reviewReport).toEqual({
      ciNotes: 'visited residence',
      creditBureauResult: 'CLEAR',
      creditBureauScore: '720',
      checkedDocuments: ['Valid ID'],
    });
  });

  it('tagPreApproval() throws outside UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    expect(() => application.tagPreApproval('user-1')).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('tagPreApproval() moves UNDER_REVIEW to PRE_APPROVAL and records the tagger', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.tagPreApproval('user-2');

    const props = application.toProps();
    expect(props.status).toBe('PRE_APPROVAL');
    expect(props.preApprovedByUserId).toBe('user-2');
    expect(props.preApprovedAt).toBeInstanceOf(Date);
  });

  it.each(['PREAPPROVED', 'PREDECLINED'] as const)(
    'approve() throws from %s (Milestone C: no longer directly approvable, must go through PRE_APPROVAL)',
    (status) => {
      const application = buildApplication(status);
      application.assignProduct('version-1');
      expect(() => application.approve('user-1', undefined)).toThrow(InvalidLoanApplicationTransitionError);
    },
  );

  it('approve() throws from UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.assignProduct('version-1');
    expect(() => application.approve('user-1', undefined)).toThrow(InvalidLoanApplicationTransitionError);
  });

  it('approve() succeeds from PRE_APPROVAL once a product is assigned', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.tagPreApproval('user-2');
    application.assignProduct('version-1');
    application.approve('user-3', 'final approval');

    const props = application.toProps();
    expect(props.status).toBe('APPROVED');
    expect(props.reviewedByUserId).toBe('user-3');
  });

  it('updateReviewReport() is locked once PRE_APPROVAL is reached', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.tagPreApproval('user-2');
    expect(() => application.updateReviewReport({ ciNotes: 'too late' })).toThrow(InvalidLoanApplicationTransitionError);
  });

  it.each(['PREAPPROVED', 'PREDECLINED'] as const)('decline() still succeeds from %s', (status) => {
    const application = buildApplication(status);
    application.decline('user-1', 'insufficient income');
    expect(application.toProps().status).toBe('DECLINED');
  });

  it('decline() succeeds from UNDER_REVIEW', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.decline('user-1', 'credit bureau flagged');
    expect(application.toProps().status).toBe('DECLINED');
  });

  it('decline() succeeds from PRE_APPROVAL', () => {
    const application = buildApplication('PREAPPROVED');
    application.startReview('user-1');
    application.tagPreApproval('user-2');
    application.decline('user-1', 'manager overrode the tag');
    expect(application.toProps().status).toBe('DECLINED');
  });

  it('decline() throws once already DECLINED', () => {
    const application = buildApplication('PREAPPROVED');
    application.decline('user-1', 'no');
    expect(() => application.decline('user-1', 'no again')).toThrow(InvalidLoanApplicationTransitionError);
  });
});
