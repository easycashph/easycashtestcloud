export interface CreateBorrowerInput {
  branchId: string;
  assignedLoanOfficerId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  birthDate?: Date;
  civilStatus?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  legacyId?: string;
}

export interface CreateCoBorrowerInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
  phoneNumber?: string;
  emailAddress?: string;
  relationship?: string;
  legacyId?: string;
}
