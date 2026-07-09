/**
 * Mirrors `app/backend`'s `LoanApplicationPresenter.presentLoanApplication()` JSON shape exactly
 * — see `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating
 * them. Unlike loan accounts, application amounts are plain `number` on the wire, not decimal
 * strings (the backend presenter sends them as numbers, not `Money`).
 */
export type LoanApplicationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'DECLINED';
export type LoanApplicationReviewState = 'UNREVIEWED' | 'REVIEWED';
export type LoanApplicationAccountType = 'NEW' | 'RENEWAL';

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
  referralSource: string | null;
  accountType: LoanApplicationAccountType | null;
  loanPurpose: string | null;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments: string[];
  encodedByUserId: string | null;
  status: LoanApplicationStatus;
  reviewState: LoanApplicationReviewState;
  assignedLoanProductVersionId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
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
  referralSource?: string;
  accountType?: LoanApplicationAccountType;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments?: string[];
}
