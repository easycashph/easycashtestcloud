import type { LoanApplication } from '../../../domain/LoanApplication';
import type { PreQualificationBreakdown } from '../../../application/services/LoanApplicationPreQualificationService';

/** Whether/what "Create Client Profile" and "Create Loan Account" have already produced for this
 * application - looked up separately by the controller (Borrower/LoanAccount live in other
 * modules) and passed in here, never derived from the LoanApplication aggregate itself. */
export interface LoanApplicationLinkage {
  createdBorrowerId: string | null;
  createdLoanAccountId: string | null;
  createdLoanAccountCode: string | null;
}

const NO_LINKAGE: LoanApplicationLinkage = { createdBorrowerId: null, createdLoanAccountId: null, createdLoanAccountCode: null };

/** Milestone 9.2 / D-5 convention: the only place a LoanApplication becomes JSON-safe.
 * `breakdown` is optional purely for callers/tests that don't need the decision-scoring
 * explanation — every real HTTP route passes it (see `LoanApplicationController.present`). */
export function presentLoanApplication(application: LoanApplication, breakdown?: PreQualificationBreakdown, linkage?: LoanApplicationLinkage) {
  const l = linkage ?? NO_LINKAGE;
  const p = application.toProps();
  return {
    id: p.id,
    branchId: p.branchId,
    borrowerId: p.borrowerId ?? null,
    applicantName: p.applicantName,
    age: p.age ?? null,
    gender: p.gender ?? null,
    civilStatus: p.civilStatus ?? null,
    birthDate: p.birthDate?.toISOString() ?? null,
    placeOfBirth: p.placeOfBirth ?? null,
    nationality: p.nationality ?? null,
    homeOwnership: p.homeOwnership ?? null,
    address: p.address ?? null,
    houseUnitNumber: p.houseUnitNumber ?? null,
    street: p.street ?? null,
    barangay: p.barangay ?? null,
    cityMunicipality: p.cityMunicipality ?? null,
    province: p.province ?? null,
    zipCode: p.zipCode ?? null,
    presentAddressLengthOfStayMonths: p.presentAddressLengthOfStayMonths ?? null,
    previousAddressSameAsPresent: p.previousAddressSameAsPresent,
    previousAddress: p.previousAddress ?? null,
    previousHouseUnitNumber: p.previousHouseUnitNumber ?? null,
    previousStreet: p.previousStreet ?? null,
    previousBarangay: p.previousBarangay ?? null,
    previousCityMunicipality: p.previousCityMunicipality ?? null,
    previousProvince: p.previousProvince ?? null,
    previousZipCode: p.previousZipCode ?? null,
    monthlyIncome: p.monthlyIncome ?? null,
    employer: p.employer ?? null,
    occupation: p.occupation ?? null,
    officeAddress: p.officeAddress ?? null,
    tinNumber: p.tinNumber ?? null,
    sssNumber: p.sssNumber ?? null,
    propertiesOwned: p.propertiesOwned,
    creditScore: p.creditScore ?? null,
    coBorrowerName: p.coBorrowerName ?? null,
    coBorrowerFirstName: p.coBorrowerFirstName ?? null,
    coBorrowerMiddleName: p.coBorrowerMiddleName ?? null,
    coBorrowerLastName: p.coBorrowerLastName ?? null,
    coBorrowerEmployer: p.coBorrowerEmployer ?? null,
    coBorrowerContactNumber: p.coBorrowerContactNumber ?? null,
    coBorrowerEmail: p.coBorrowerEmail ?? null,
    coBorrowerAddress: p.coBorrowerAddress ?? null,
    mobilePhone: p.mobilePhone ?? null,
    email: p.email ?? null,
    facebookLink: p.facebookLink ?? null,
    dependants: p.dependants ?? [],
    reference1Name: p.reference1Name ?? null,
    reference1Mobile: p.reference1Mobile ?? null,
    reference2Name: p.reference2Name ?? null,
    reference2Mobile: p.reference2Mobile ?? null,
    note: p.note ?? null,
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
    submissionLatitude: p.submissionLatitude ?? null,
    submissionLongitude: p.submissionLongitude ?? null,
    assignedLoanProductVersionId: p.assignedLoanProductVersionId ?? null,
    reviewedByUserId: p.reviewedByUserId ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    decisionNote: p.decisionNote ?? null,
    reviewStartedByUserId: p.reviewStartedByUserId ?? null,
    reviewStartedAt: p.reviewStartedAt?.toISOString() ?? null,
    reviewReport: p.reviewReport ?? null,
    preApprovedByUserId: p.preApprovedByUserId ?? null,
    preApprovedAt: p.preApprovedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    preQualificationBreakdown: breakdown ?? null,
    createdBorrowerId: l.createdBorrowerId,
    createdLoanAccountId: l.createdLoanAccountId,
    createdLoanAccountCode: l.createdLoanAccountCode,
  };
}
