/** Mirrors app/backend's client-portal module DTOs/presenters exactly - see apiClient.ts's doc
 * comment for why this hand-maintains the shape instead of generating it (same reasoning as the
 * internal LMS frontend's own apiClient.ts). */

export interface SignUpRequest {
  email: string;
  password: string;
  contactNumber?: string;
  verificationChannel?: 'EMAIL' | 'SMS';
}

export interface SignUpResponse {
  challengeId: string;
  channel: 'EMAIL' | 'SMS';
}

export interface VerifySignUpRequest {
  challengeId: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PortalAccountView {
  id: string;
  email: string;
  contactNumber: string | null;
  borrowerId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  account: PortalAccountView;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  challengeId: string | null;
}

export interface ResetPasswordRequest {
  challengeId: string;
  code: string;
  newPassword: string;
}

export type MeResponse = PortalAccountView;

/** Mirrors app/backend's client-portal Phase 2 (loan application submission) DTOs. */
export interface PortalBranch {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

/** Core-fields-only subset - see backend's PortalLoanApplicationDtos.ts for why the full
 * staff-facing field set (credit score, TIN/SSS, dependants, etc.) isn't exposed here. */
export interface SubmitLoanApplicationRequest {
  branchId: string;
  applicantName: string;
  birthDate?: string;
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

export type LoanApplicationStatus = 'PREAPPROVED' | 'PREDECLINED' | 'UNDER_REVIEW' | 'PRE_APPROVAL' | 'APPROVED' | 'DECLINED';

export interface PortalLoanApplicationSummary {
  id: string;
  branchId: string;
  status: LoanApplicationStatus;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  createdAt: string;
}

export type PortalDocumentCategory = 'VALID_ID_BORROWER' | 'PROOF_OF_BILLING' | 'CORPORATE_PAYSLIP';

export interface UploadedDocument {
  id: string;
  fileName: string;
  documentCategory: PortalDocumentCategory | null;
}
