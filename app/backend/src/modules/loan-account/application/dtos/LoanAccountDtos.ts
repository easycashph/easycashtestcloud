export interface CreateLoanAccountInput {
  loanCode: string;
  borrowerId: string;
  loanProductVersionId: string;
  branchId: string;
  loanOfficerId?: string;
  principalAmount: string;
  interestRate: string;
  addOnInterestRate?: string;
  contractualInterestRate?: string;
  installmentCount: number;
  gracePeriodDays?: number;
  legacyId?: string;
}
