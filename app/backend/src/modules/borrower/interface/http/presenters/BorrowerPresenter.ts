import type { Address } from '../../../domain/valueObjects/Address';
import type { Borrower } from '../../../domain/Borrower';
import type { CoBorrower } from '../../../domain/CoBorrower';

/**
 * Milestone 8 / D-5: the ONLY place Borrower/CoBorrower domain objects are
 * converted to JSON-safe response shapes. Controllers call these functions
 * and never touch Date/VO formatting themselves.
 */
function presentAddress(address: Address) {
  return { ...address.toProps() };
}

export function presentBorrower(borrower: Borrower) {
  return {
    id: borrower.id,
    branchId: borrower.branchId,
    assignedLoanOfficerId: borrower.assignedLoanOfficerId ?? null,
    firstName: borrower.name.firstName,
    middleName: borrower.name.middleName ?? null,
    lastName: borrower.name.lastName,
    fullName: borrower.name.fullName(),
    gender: borrower.gender ?? null,
    birthDate: borrower.birthDate?.toISOString() ?? null,
    civilStatus: borrower.civilStatus ?? null,
    mobilePhone1: borrower.mobilePhone1 ?? null,
    mobilePhone2: borrower.mobilePhone2 ?? null,
    email: borrower.email ?? null,
    status: borrower.status,
    loanCycle: borrower.loanCycle,
    legacyId: borrower.legacyId ?? null,
    createdAt: borrower.createdAt.toISOString(),
    updatedAt: borrower.updatedAt.toISOString(),
    incomeDetail: borrower.incomeDetail ?? null,
    governmentId: borrower.governmentId ?? null,
    identificationDocuments: borrower.identificationDocuments.map((doc) => ({
      ...doc,
      validUntil: doc.validUntil?.toISOString() ?? null,
    })),
    characterReferences: [...borrower.characterReferences],
    addresses: borrower.addresses.map(presentAddress),
  };
}

export function presentCoBorrower(coBorrower: CoBorrower) {
  return {
    id: coBorrower.id,
    firstName: coBorrower.name.firstName,
    middleName: coBorrower.name.middleName ?? null,
    lastName: coBorrower.name.lastName,
    fullName: coBorrower.name.fullName(),
    gender: coBorrower.gender ?? null,
    civilStatus: coBorrower.civilStatus ?? null,
    birthDate: coBorrower.birthDate?.toISOString() ?? null,
    phoneNumber: coBorrower.phoneNumber ?? null,
    emailAddress: coBorrower.emailAddress ?? null,
    relationship: coBorrower.relationship ?? null,
    legacyId: coBorrower.legacyId ?? null,
    addresses: coBorrower.addresses.map(presentAddress),
  };
}
