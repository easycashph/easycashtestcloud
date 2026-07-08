import type { LoanApplication } from '../../../domain/LoanApplication';

/** Milestone 9.2 / D-5 convention: the only place a LoanApplication becomes JSON-safe. */
export function presentLoanApplication(application: LoanApplication) {
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
    referralSource: p.referralSource ?? null,
    accountType: p.accountType ?? null,
    loanPurpose: p.loanPurpose ?? null,
    requestedCategory: p.requestedCategory,
    requestedAmount: p.requestedAmount,
    requestedTermMonths: p.requestedTermMonths,
    submittedDocuments: p.submittedDocuments,
    encodedByUserId: p.encodedByUserId ?? null,
    status: p.status,
    reviewState: p.reviewState,
    assignedLoanProductVersionId: p.assignedLoanProductVersionId ?? null,
    reviewedByUserId: p.reviewedByUserId ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    decisionNote: p.decisionNote ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
