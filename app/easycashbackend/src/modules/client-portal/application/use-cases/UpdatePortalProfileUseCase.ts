import { NotFoundError } from '@shared/errors/DomainError';
import { UpdateBorrowerUseCase } from '@modules/borrower/application/use-cases/UpdateBorrowerUseCase';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { UpdatePortalProfileInput, PortalProfileDto } from '../dtos/PortalProfileDtos';
import { GetPortalProfileUseCase } from './GetPortalProfileUseCase';

/**
 * Phase D (2026-07-24 user request): a linked portal client can edit their own contact info
 * (mobile, email, present address) directly on the real `Borrower` record the LMS uses - delegates
 * to the same `UpdateBorrowerUseCase` staff use, just called with an input restricted to the
 * confirmed self-service scope, so the write path (and its ADR-050 activity logging) is identical
 * either way. Name/government IDs/dependants/references stay staff-editable-only even here.
 *
 * 2026-07-30 (user request): an unlinked account (no Borrower yet) now writes to its own
 * pre-application profile columns instead of throwing `PortalAccountNotLinkedError` - this is the
 * ONE case where name (`firstName`/`middleName`/`lastName`/`suffix`) IS self-service editable,
 * since there's no staff-owned Borrower record yet to defer to.
 */
export class UpdatePortalProfileUseCase {
  constructor(
    private readonly deps: {
      portalAccountRepository: IPortalAccountRepository;
      updateBorrowerUseCase: UpdateBorrowerUseCase;
      getPortalProfileUseCase: GetPortalProfileUseCase;
    },
  ) {}

  async execute(portalAccountId: string, input: UpdatePortalProfileInput): Promise<PortalProfileDto> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account) {
      throw new NotFoundError('PortalAccount', portalAccountId);
    }

    if (!account.borrowerId) {
      await this.deps.portalAccountRepository.update(portalAccountId, {
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        suffix: input.suffix,
        gender: input.gender,
        birthDate: input.birthDate,
        placeOfBirth: input.placeOfBirth,
        nationality: input.nationality,
        civilStatus: input.civilStatus,
        homeOwnership: input.homeOwnership,
        mobilePhone1: input.mobilePhone1,
        mobilePhone2: input.mobilePhone2,
        occupation: input.occupation,
        employer: input.employer,
        monthlyIncome: input.monthlyIncome,
        houseUnitNumber: input.addresses?.[0]?.houseUnitNumber,
        street: input.addresses?.[0]?.street,
        barangay: input.addresses?.[0]?.barangay,
        cityMunicipality: input.addresses?.[0]?.cityMunicipality,
        province: input.addresses?.[0]?.province,
        zipCode: input.addresses?.[0]?.zipCode,
      });
      return this.deps.getPortalProfileUseCase.execute(portalAccountId);
    }

    await this.deps.updateBorrowerUseCase.execute(account.borrowerId, {
      gender: input.gender,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      nationality: input.nationality,
      civilStatus: input.civilStatus,
      homeOwnership: input.homeOwnership,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
      occupation: input.occupation,
      employer: input.employer,
      monthlyIncome: input.monthlyIncome,
      addresses: input.addresses,
    });
    return this.deps.getPortalProfileUseCase.execute(portalAccountId);
  }
}
