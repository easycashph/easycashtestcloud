import type { DependantEntry, LoanApplicationAccountType } from '../../domain/LoanApplication';

export interface CreateLoanApplicationInput {
  branchId: string;
  borrowerId?: string;
  /** Set when this application was submitted through the Easycash Portal by a client, as opposed
   * to encoded by staff (encodedByUserId) or a legacy walk-in. */
  portalAccountId?: string;
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
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  propertiesOwned?: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerFirstName?: string;
  coBorrowerMiddleName?: string;
  coBorrowerLastName?: string;
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
  submittedDocuments?: string[];
  encodedByUserId?: string;
  /** 2026-07-24 — applicant's device GPS coordinates at submission time (portal only, optional/
   * best-effort). See schema.prisma's doc comment on LoanApplication.submissionLatitude. */
  submissionLatitude?: number;
  submissionLongitude?: number;
}
