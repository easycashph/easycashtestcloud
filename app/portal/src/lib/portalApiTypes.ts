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

/** 2026-07-24 (user request): mirrors the staff-facing form's full field set - see backend's
 * PortalLoanApplicationDtos.ts doc comment for exactly what's excluded (AI Auto-fill, "use a
 * previous co-borrower", encodedByUserId) and why. */
export interface DependantEntry {
  name: string;
  age?: string;
  relationship?: string;
}

export interface SubmitLoanApplicationRequest {
  branchId: string;
  applicantName: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  birthDate?: string;
  placeOfBirth?: string;
  nationality?: string;
  homeOwnership?: string;
  address?: string;
  houseUnitNumber?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;
  previousAddressSameAsPresent?: boolean;
  previousAddress?: string;
  previousHouseUnitNumber?: string;
  previousStreet?: string;
  previousBarangay?: string;
  previousCityMunicipality?: string;
  previousProvince?: string;
  previousZipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  coBorrowerName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  dependants?: DependantEntry[];
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  note?: string;
  referralSource?: string;
  accountType?: 'NEW' | 'RENEWAL';
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  /** 2026-07-24 (user request) - device GPS coordinates captured client-side at submission time,
   * best-effort only (see LoanApplicationFormPage's getBestEffortGeolocation()). */
  submissionLatitude?: number;
  submissionLongitude?: number;
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

/** 2026-07-24 (user request) - the full record shape returned by GET/PATCH
 * /portal/loan-applications/:id, used to prefill and save the portal's "edit my application"
 * form. Mirrors backend's portalLoanApplicationController.ts's presentFullApplication(). */
export interface PortalLoanApplicationDetail {
  id: string;
  branchId: string;
  status: LoanApplicationStatus;
  applicantName: string;
  age: number | null;
  gender: string | null;
  civilStatus: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  homeOwnership: string | null;
  address: string | null;
  houseUnitNumber: string | null;
  street: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
  previousAddressSameAsPresent: boolean;
  previousAddress: string | null;
  previousHouseUnitNumber: string | null;
  previousStreet: string | null;
  previousBarangay: string | null;
  previousCityMunicipality: string | null;
  previousProvince: string | null;
  previousZipCode: string | null;
  monthlyIncome: number | null;
  employer: string | null;
  occupation: string | null;
  officeAddress: string | null;
  tinNumber: string | null;
  sssNumber: string | null;
  coBorrowerName: string | null;
  coBorrowerEmployer: string | null;
  coBorrowerContactNumber: string | null;
  coBorrowerEmail: string | null;
  coBorrowerAddress: string | null;
  mobilePhone: string | null;
  email: string | null;
  dependants: DependantEntry[] | null;
  reference1Name: string | null;
  reference1Mobile: string | null;
  reference2Name: string | null;
  reference2Mobile: string | null;
  note: string | null;
  referralSource: string | null;
  accountType: 'NEW' | 'RENEWAL' | null;
  loanPurpose: string | null;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  createdAt: string;
  updatedAt: string;
}

export type PortalDocumentCategory =
  | 'VALID_ID_BORROWER'
  | 'VALID_ID_CO_BORROWER'
  | 'PROOF_OF_BILLING'
  | 'EMPLOYEE_ID'
  | 'BUSINESS_CLEARANCE'
  | 'CORPORATE_PAYSLIP'
  | 'SEAMANS_BOOK'
  | 'OVERSEAS_EMPLOYMENT_CERTIFICATE';

export interface UploadedDocument {
  id: string;
  fileName: string;
  documentCategory: PortalDocumentCategory | null;
}

/** Mirrors app/backend's psgc module (IPsgcRepository.ts) - powers the loan application form's
 * cascading region/province/city/barangay address picker with ZIP auto-fill. */
export interface PsgcOption {
  code: string;
  name: string;
}

export interface PsgcCityOption extends PsgcOption {
  zipCode: string | null;
}

export interface PsgcBarangayOption extends PsgcOption {
  zipCode: string | null;
}

export interface ResolvedAddressCodes {
  regionCode: string | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  barangayCode: string | null;
}

/** 2026-07-24 (user request, Phase C) - mirrors backend's PortalNotificationPresenter.ts. Only the
 * 2 client-facing loan decision milestones today (Approved/Declined), not every review stage. */
export type PortalNotificationType = 'APPLICATION_APPROVED' | 'APPLICATION_DECLINED';

export interface PortalNotification {
  id: string;
  type: PortalNotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PortalNotificationListResponse {
  items: PortalNotification[];
  nextCursor: string | null;
  unreadCount: number;
}
