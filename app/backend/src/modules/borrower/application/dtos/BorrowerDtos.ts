export interface CreateBorrowerIncomeDetailInput {
  employmentType?: string;
  employerName?: string;
  employerAddress?: string;
  natureOfBusiness?: string;
  position?: string;
  yearsEmployed?: number;
}

export interface CreateBorrowerGovernmentIdInput {
  sssNumber?: string;
  tinNumber?: string;
}

export interface CreateBorrowerCharacterReferenceInput {
  firstName: string;
  lastName?: string;
  relationship?: string;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface CreateBorrowerDependantInput {
  name: string;
  age?: string;
  relationship?: string;
}

export interface CreateBorrowerInput {
  branchId: string;
  assignedLoanOfficerId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  dependants?: CreateBorrowerDependantInput[];
  note?: string;
  legacyId?: string;
  sourceApplicationId?: string;
  incomeDetail?: CreateBorrowerIncomeDetailInput;
  governmentId?: CreateBorrowerGovernmentIdInput;
  characterReferences?: CreateBorrowerCharacterReferenceInput[];
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
  employer?: string;
  legacyId?: string;
}
