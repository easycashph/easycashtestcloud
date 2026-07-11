import type { LoanApplicationAccountType } from '../../domain/LoanApplication';

export interface CreateLoanApplicationInput {
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
  encodedByUserId?: string;
}
