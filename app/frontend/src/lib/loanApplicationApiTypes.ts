/**
 * Mirrors `app/backend`'s `LoanApplicationPresenter.presentLoanApplication()` JSON shape exactly
 * - see `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating
 * them. Unlike loan accounts, application amounts are plain `number` on the wire, not decimal
 * strings (the backend presenter sends them as numbers, not `Money`).
 *
 * PREAPPROVED/PREDECLINED are computed by the backend's LoanApplicationPreQualificationService -
 * advisory only, the officer still makes the real APPROVED/DECLINED call.
 */
export type LoanApplicationStatus = 'PREAPPROVED' | 'PREDECLINED' | 'APPROVED' | 'DECLINED';
export type LoanApplicationAccountType = 'NEW' | 'RENEWAL';

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
}

export interface LoanApplication {
  id: string;
  branchId: string;
  applicantName: string;
  age: number | null;
  address: string | null;
  monthlyIncome: number | null;
  employer: string | null;
  propertiesOwned: string[];
  creditScore: number | null;
  coBorrowerName: string | null;
  mobilePhone: string | null;
  email: string | null;
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
  assignedLoanProductVersionId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  preQualificationBreakdown: PreQualificationBreakdown | null;
}

/** Body for `POST /loan-applications`. `branchId` is overridden server-side for non-global roles. */
export interface CreateLoanApplicationRequest {
  branchId: string;
  applicantName: string;
  age?: number;
  address?: string;
  monthlyIncome?: number;
  employer?: string;
  propertiesOwned?: string[];
  creditScore?: number;
  coBorrowerName?: string;
  mobilePhone?: string;
  email?: string;
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
