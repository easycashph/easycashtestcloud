import type { DependantEntry, LoanApplicationAccountType } from '@modules/loan-application/domain/LoanApplication';

/** 2026-07-24 (user request): the full staff-facing form's field set, minus what genuinely can't
 * apply to a public self-service submission - AI Auto-fill (a local-Ollama-only staff convenience
 * feature, not reachable from the internet, and a needless attack surface for a form where the
 * applicant already knows their own info), "use a previous co-borrower" (searches OTHER clients'
 * application history - a data-leak risk if exposed publicly), and encodedByUserId (no staff
 * encoder exists for a self-service submission). Credit score and properties owned are likewise
 * absent - those aren't in the staff form's CREATE payload either, only edited later on the
 * Detail page's Risk Management Summary. */
export interface SubmitLoanApplicationInput {
  branchId: string;
  applicantName: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
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
  accountType?: LoanApplicationAccountType;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  /** 2026-07-24 (user request) — applicant's device GPS coordinates at submission time, captured
   * client-side via the browser's Geolocation API. Optional/best-effort - the portal form never
   * blocks submission on a denied/unavailable permission. */
  submissionLatitude?: number;
  submissionLongitude?: number;
}

export interface PortalLoanApplicationSummary {
  id: string;
  branchId: string;
  status: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  createdAt: Date;
  /** 2026-07-31 (user request): true once every required document for this product (see
   * requiredDocumentCategories.ts) has been attached - backs the Portal dashboard's
   * missing-documents indicator. */
  documentsComplete: boolean;
}

export interface PortalBranchSummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
}
