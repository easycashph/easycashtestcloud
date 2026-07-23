/** Core-fields-only subset of loan-application's CreateLoanApplicationInput (Phase 2 design
 * decision, 2026-07-23): the staff-facing form has 40+ fields (credit score, TIN/SSS, properties
 * owned, dependants, etc.) that aren't appropriate for client self-service intake. Anything not
 * listed here is left unset on the created LoanApplication and can still be filled in by staff
 * during review. */
export interface SubmitLoanApplicationInput {
  branchId: string;
  applicantName: string;
  birthDate?: Date;
  gender?: string;
  civilStatus?: string;
  homeOwnership?: string;
  address?: string;
  houseUnitNumber?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  coBorrowerName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
}

export interface PortalLoanApplicationSummary {
  id: string;
  branchId: string;
  status: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  createdAt: Date;
}

export interface PortalBranchSummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
}
