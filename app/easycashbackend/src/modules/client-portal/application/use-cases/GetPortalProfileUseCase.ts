import { NotFoundError } from '@shared/errors/DomainError';
import type { Borrower } from '@modules/borrower/domain/Borrower';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IPortalAccountRepository, PortalAccountRecord } from '../ports/IPortalAccountRepository';
import type { PortalProfileDto } from '../dtos/PortalProfileDtos';
import { GetPortalProfilePhotoUseCase } from './GetPortalProfilePhotoUseCase';

function fromBorrower(borrower: Borrower, hasProfilePhoto: boolean): PortalProfileDto {
  return {
    id: borrower.id,
    hasProfilePhoto,
    firstName: borrower.name.firstName,
    middleName: borrower.name.middleName ?? null,
    lastName: borrower.name.lastName,
    suffix: borrower.suffix ?? null,
    gender: borrower.gender ?? null,
    birthDate: borrower.birthDate ? borrower.birthDate.toISOString().slice(0, 10) : null,
    placeOfBirth: borrower.placeOfBirth ?? null,
    nationality: borrower.nationality ?? null,
    civilStatus: borrower.civilStatus ?? null,
    homeOwnership: borrower.homeOwnership ?? null,
    mobilePhone1: borrower.mobilePhone1 ?? null,
    mobilePhone2: borrower.mobilePhone2 ?? null,
    email: borrower.email ?? null,
    occupation: borrower.incomeDetail?.position ?? null,
    employer: borrower.incomeDetail?.employerName ?? null,
    monthlyIncome: borrower.incomeDetail?.monthlyIncome ?? null,
    officeAddress: borrower.incomeDetail?.employerAddress ?? null,
    tinNumber: borrower.governmentId?.tinNumber ?? null,
    sssNumber: borrower.governmentId?.sssNumber ?? null,
    dependants: (borrower.dependants ?? []).map((d) => ({ name: d.name, age: d.age, relationship: d.relationship })),
    reference1Name: borrower.characterReferences[0] ? [borrower.characterReferences[0].firstName, borrower.characterReferences[0].lastName].filter(Boolean).join(' ') : null,
    reference1Mobile: borrower.characterReferences[0]?.phoneNumber ?? null,
    reference2Name: borrower.characterReferences[1] ? [borrower.characterReferences[1].firstName, borrower.characterReferences[1].lastName].filter(Boolean).join(' ') : null,
    reference2Mobile: borrower.characterReferences[1]?.phoneNumber ?? null,
    addresses: borrower.addresses.map((address) => ({
      addressType: address.addressType ?? null,
      houseUnitNumber: address.houseUnitNumber ?? null,
      street: address.street ?? null,
      barangay: address.barangay ?? null,
      cityMunicipality: address.cityMunicipality ?? null,
      province: address.province ?? null,
      zipCode: address.zipCode ?? null,
    })),
  };
}

/** 2026-07-30 (user request): a client who hasn't been linked to a real Borrower yet (no MIS staff
 * has run "Create Client Profile") still gets a real, editable profile - backed by the new
 * pre-application profile columns on PortalAccount itself rather than a Borrower record that
 * doesn't exist yet. `id` is the PortalAccount's own id here (there's no Borrower id to use). */
function fromPortalAccount(account: PortalAccountRecord, hasProfilePhoto: boolean): PortalProfileDto {
  return {
    id: account.id,
    hasProfilePhoto,
    firstName: account.firstName ?? '',
    middleName: account.middleName,
    lastName: account.lastName ?? '',
    suffix: account.suffix,
    gender: account.gender,
    birthDate: account.birthDate ? account.birthDate.toISOString().slice(0, 10) : null,
    placeOfBirth: account.placeOfBirth,
    nationality: account.nationality,
    civilStatus: account.civilStatus,
    homeOwnership: account.homeOwnership,
    mobilePhone1: account.mobilePhone1 ?? account.contactNumber,
    mobilePhone2: account.mobilePhone2,
    email: account.email,
    occupation: account.occupation,
    employer: account.employer,
    monthlyIncome: account.monthlyIncome,
    officeAddress: account.officeAddress,
    tinNumber: account.tinNumber,
    sssNumber: account.sssNumber,
    dependants: account.dependants ?? [],
    reference1Name: account.reference1Name,
    reference1Mobile: account.reference1Mobile,
    reference2Name: account.reference2Name,
    reference2Mobile: account.reference2Mobile,
    addresses:
      account.houseUnitNumber || account.street || account.barangay || account.cityMunicipality || account.province || account.zipCode
        ? [
            {
              addressType: null,
              houseUnitNumber: account.houseUnitNumber,
              street: account.street,
              barangay: account.barangay,
              cityMunicipality: account.cityMunicipality,
              province: account.province,
              zipCode: account.zipCode,
            },
          ]
        : [],
  };
}

/**
 * Phase D (2026-07-24 user request): a linked portal client's profile reads straight off the real
 * `Borrower` record the LMS itself uses (linked via `PortalAccount.borrowerId`, set at "Create
 * Client Profile" time) - not a separate copy, so LMS and portal are always in sync by
 * construction.
 *
 * 2026-07-30 (user request): previously this threw `PortalAccountNotLinkedError` for an unlinked
 * account, and the portal frontend fell back to letting the client edit a draft LoanApplication
 * instead (only possible once one existed). Now it always succeeds - an unlinked account gets its
 * own pre-application profile view/edit surface instead (`fromPortalAccount` above).
 */
export class GetPortalProfileUseCase {
  constructor(
    private readonly deps: {
      portalAccountRepository: IPortalAccountRepository;
      borrowerRepository: IBorrowerRepository;
      attachmentRepository: IAttachmentRepository;
    },
  ) {}

  async execute(portalAccountId: string): Promise<PortalProfileDto> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account) {
      throw new NotFoundError('PortalAccount', portalAccountId);
    }

    // Always keyed by the PortalAccount's own id, not the Borrower's - a profile photo is a
    // property of the account/login, not of whichever Borrower record it may or may not be
    // linked to yet (see UploadPortalProfilePhotoUseCase's own doc comment).
    const getPortalProfilePhotoUseCase = new GetPortalProfilePhotoUseCase(this.deps);
    const photo = await getPortalProfilePhotoUseCase.execute(portalAccountId);

    if (!account.borrowerId) {
      return fromPortalAccount(account, photo !== null);
    }

    const borrower = await this.deps.borrowerRepository.findById(account.borrowerId);
    if (!borrower) {
      throw new NotFoundError('Borrower', account.borrowerId);
    }
    return fromBorrower(borrower, photo !== null);
  }
}
