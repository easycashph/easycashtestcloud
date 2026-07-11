import type { LoanApplication } from '../../../domain/LoanApplication';
import type { PreQualificationBreakdown } from '../../../application/services/LoanApplicationPreQualificationService';

/** Milestone 9.2 / D-5 convention: the only place a LoanApplication becomes JSON-safe.
 * `breakdown` is optional purely for callers/tests that don't need the decision-scoring
 * explanation — every real HTTP route passes it (see `LoanApplicationController.present`). */
export function presentLoanApplication(application: LoanApplication, breakdown?: PreQualificationBreakdown) {
  const p = application.toProps();
  return {
    id: p.id,
    branchId: p.branchId,
    applicantName: p.applicantName,
    age: p.age ?? null,
    address: p.address ?? null,
    monthlyIncome: p.monthlyIncome ?? null,
    employer: p.employer ?? null,
    propertiesOwned: p.propertiesOwned,
    creditScore: p.creditScore ?? null,
    coBorrowerName: p.coBorrowerName ?? null,
    mobilePhone: p.mobilePhone ?? null,
    email: p.email ?? null,
    referralSource: p.referralSource ?? null,
    accountType: p.accountType ?? null,
    loanPurpose: p.loanPurpose ?? null,
    requestedCategory: p.requestedCategory,
    requestedAmount: p.requestedAmount,
    requestedTermMonths: p.requestedTermMonths,
    submittedDocuments: p.submittedDocuments,
    encodedByUserId: p.encodedByUserId ?? null,
    status: p.status,
    distanceFromBranchKm: p.distanceFromBranchKm ?? null,
    assignedLoanProductVersionId: p.assignedLoanProductVersionId ?? null,
    reviewedByUserId: p.reviewedByUserId ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    decisionNote: p.decisionNote ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    preQualificationBreakdown: breakdown ?? null,
  };
}
