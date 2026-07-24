/**
 * Mirrors `app/backend`'s `LoanApplicationPresenter.presentLoanApplication()` JSON shape exactly
 * - see `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating
 * them. Unlike loan accounts, application amounts are plain `number` on the wire, not decimal
 * strings (the backend presenter sends them as numbers, not `Money`).
 *
 * PREAPPROVED/PREDECLINED are computed by the backend's LoanApplicationPreQualificationService -
 * advisory only. From PREAPPROVED, a CRM/MIS/Loan Operation Manager user Starts Review
 * (UNDER_REVIEW), Tags Pre Approval once the Review Report is complete (PRE_APPROVAL), and only
 * then can MIS/Loan Operation Manager give the final APPROVED/DECLINED call (2026-07-17, Under
 * Review / Pre Approval stages).
 */
export type LoanApplicationStatus = 'PREAPPROVED' | 'PREDECLINED' | 'UNDER_REVIEW' | 'PRE_APPROVAL' | 'APPROVED' | 'DECLINED';
export type LoanApplicationAccountType = 'NEW' | 'RENEWAL';
export type CreditBureauResult = 'CLEAR' | 'FLAGGED' | 'NO_RECORD_FOUND';

export interface CreditBureauPartyCheck {
  cmap?: string;
  kyc?: string;
  myscore?: string;
}

export interface MitigationDetails {
  bank?: string;
  branch?: string;
  accountName?: string;
  accountNumber?: string;
  atmCardNumber?: string;
  allotmentAmount?: string;
}

export interface AgencyVerificationDetails {
  agencyName?: string;
  agencyAddress?: string;
  agencyContactNumbers?: string;
  yearsWithAgency?: string;
  basicMonthlySalary?: string;
  position?: string;
  vessel?: string;
  contractDuration?: string;
  joiningPort?: string;
  dateOfDeparture?: string;
  departureStatus?: string;
  expectedSignOffDate?: string;
  monthlySalary?: string;
  allottee1Name?: string;
  allottee1Bank?: string;
  allottee1AccountNumber?: string;
  allottee1Amount?: string;
  allottee2Name?: string;
  allottee2Bank?: string;
  allottee2AccountNumber?: string;
  allottee2Amount?: string;
  payrollSchedule?: string;
  firstFullAllotmentDate?: string;
  cashAdvance?: string;
  mannerOfDeduction?: string;
  sourceName?: string;
  sourcePosition?: string;
}

/** 2026-07-17 (Under Review / Pre Approval stages) — CI/Credit Bureau/document-checklist findings
 * captured while UNDER_REVIEW. `checkedDocuments` is the subset of `submittedDocuments` the
 * reviewer has verified, not an independent list.
 *
 * 2026-07-21 — redesigned against the legacy Credit Evaluation Report (CER) template.
 * `creditBureauResult`/`creditBureauScore`/`ciNotes` are kept only so reports saved before this
 * date still round-trip; the current form writes `creditBureauBorrower`/`creditBureauCoBorrower`,
 * `mitigation`, `agencyVerification`, `conditionsForApproval`, and `crmRecommendation` instead. */
export type DocumentVerificationStatus = 'VERIFIED' | 'REJECTED';
export interface DocumentVerificationEntry {
  status: DocumentVerificationStatus;
  reason?: string;
}

export interface LoanApplicationReviewReport {
  ciNotes?: string;
  creditBureauResult?: CreditBureauResult;
  creditBureauScore?: string;
  checkedDocuments: string[];
  documentVerifications?: Record<string, DocumentVerificationEntry>;
  documentsVerifiedByUserId?: string;
  documentsVerifiedAt?: string;
  creditBureauBorrower?: CreditBureauPartyCheck;
  creditBureauCoBorrower?: CreditBureauPartyCheck;
  mitigation?: MitigationDetails;
  agencyVerification?: AgencyVerificationDetails;
  conditionsForApproval?: string;
  crmRecommendation?: string;
}

/** Body for `PATCH /loan-applications/:id/review-report` — PATCH semantics, send only what
 * changed. `checkedDocuments`/`documentVerifications`, when present, replace the full checklist
 * state. */
export interface SubmitReviewReportRequest {
  ciNotes?: string;
  creditBureauResult?: CreditBureauResult;
  creditBureauScore?: string;
  checkedDocuments?: string[];
  documentVerifications?: Record<string, DocumentVerificationEntry>;
  creditBureauBorrower?: CreditBureauPartyCheck;
  creditBureauCoBorrower?: CreditBureauPartyCheck;
  mitigation?: MitigationDetails;
  agencyVerification?: AgencyVerificationDetails;
  conditionsForApproval?: string;
  crmRecommendation?: string;
}

/** Response shape for `POST /loan-applications/:id/ai-document-review`.
 *
 * MOCKED (2026-07-22) — the backend returns a deterministic placeholder, not a real model call
 * (local Ollama vs. cloud Claude API is still an open decision). `mock: true` and the
 * "[Preview]" prefixes on every user-facing string exist so this is never mistaken for a real
 * assessment before the real model integration lands. */
export interface AiDocumentReviewResult {
  mock: true;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  keyFactors: string[];
  crossChecks: Array<{ label: string; result: string; flagged: boolean }>;
  documentChecklist: Array<{ document: string; status: 'OK' | 'NEEDS_ATTENTION'; note: string }>;
}

export interface PreQualificationCheck {
  passed: boolean;
  label: string;
  detail: string;
}

/** The "why" behind `status` - mirrors the backend's `LoanApplicationPreQualificationService`
 * `evaluateCriteria()` output, re-derived on every read (cheap, no I/O - reuses the cached
 * `distanceFromBranchKm`, never re-geocodes). */
export interface PreQualificationBreakdown {
  status: 'PREAPPROVED' | 'PREDECLINED';
  checks: {
    age: PreQualificationCheck;
    income: PreQualificationCheck;
    distance: PreQualificationCheck;
  };
  /** Same figure the income check's own `detail` text already describes in words - a raw number
   * too (2026-07-20, Underwriting rework) so the Debt-to-Income ratio can be computed without
   * parsing it back out of that sentence. */
  estimatedMonthlyAmortization: number;
}

export interface LoanApplicationDependant {
  name: string;
  age?: string;
  relationship?: string;
}

export interface LoanApplication {
  id: string;
  branchId: string;
  /** Set only when this application was created FROM an existing client's profile ("Create Loan
   * Application" renewal flow) - null for the original walk-in intake flow (no client yet). */
  borrowerId: string | null;
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
  propertiesOwned: string[];
  creditScore: number | null;
  coBorrowerName: string | null;
  coBorrowerEmployer: string | null;
  coBorrowerContactNumber: string | null;
  coBorrowerEmail: string | null;
  coBorrowerAddress: string | null;
  mobilePhone: string | null;
  email: string | null;
  dependants: LoanApplicationDependant[];
  reference1Name: string | null;
  reference1Mobile: string | null;
  reference2Name: string | null;
  reference2Mobile: string | null;
  note: string | null;
  referralSource: string | null;
  accountType: LoanApplicationAccountType | null;
  loanPurpose: string | null;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments: string[];
  encodedByUserId: string | null;
  status: LoanApplicationStatus;
  distanceFromBranchKm: number | null;
  /** 2026-07-24 — the applicant's device GPS coordinates at submission time (Easycash Portal
   * submissions only, optional/best-effort - null for staff-encoded walk-ins and for a portal
   * client who denied/lacks the browser's location permission). */
  submissionLatitude: number | null;
  submissionLongitude: number | null;
  assignedLoanProductVersionId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  reviewStartedByUserId: string | null;
  reviewStartedAt: string | null;
  reviewReport: LoanApplicationReviewReport | null;
  preApprovedByUserId: string | null;
  preApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
  preQualificationBreakdown: PreQualificationBreakdown | null;
  /** Set once "Create Client Profile" has been used on this (Approved) application - the id of
   * the resulting Borrower, looked up server-side via Borrower.sourceApplicationId. Prevents
   * creating a duplicate client. */
  createdBorrowerId: string | null;
  /** Set once "Create Loan Account" has been used for the client created from this application. */
  createdLoanAccountId: string | null;
  createdLoanAccountCode: string | null;
}

/** Body for `POST /loan-applications`. `branchId` is overridden server-side for non-global roles. */
export interface CreateLoanApplicationRequest {
  branchId: string;
  borrowerId?: string;
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
  propertiesOwned?: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  dependants?: LoanApplicationDependant[];
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  note?: string;
  referralSource?: string;
  accountType?: LoanApplicationAccountType;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments?: string[];
}

/** Body for `PATCH /loan-applications/:id` - the Detail page's Risk Management Summary card.
 * Send only what changed; omitted fields are left untouched server-side. */
export interface UpdateLoanApplicationRequest {
  monthlyIncome?: number;
  creditScore?: number;
  propertiesOwned?: string[];
}
