import { NotFoundError } from '@shared/errors/DomainError';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { Borrower } from '../../domain/Borrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import { Address, type AddressProps } from '../../domain/valueObjects/Address';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export interface UpdateBorrowerInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  facebookLink?: string;
  occupation?: string;
  employer?: string;
  monthlyIncome?: number;
  /** 2026-07-31 (user request, Portal "My Profile" Employment section) - maps onto
   * BorrowerIncomeDetail.employerAddress, matching the label the loan application form already
   * uses for the same concept ("Office address"). */
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  dependants?: { name: string; age?: string; relationship?: string }[];
  /** Always replaces the whole set (see Borrower.replaceCharacterReferences' own doc comment) -
   * a flat 2-reference shape matching the Portal loan application form's own
   * reference1Name/reference1Mobile/reference2Name/reference2Mobile fields, not the richer
   * firstName/lastName/relationship/email shape staff can enter elsewhere. `name` is stored
   * whole in `firstName` (lastName left blank) - self-service references are a single free-text
   * full name, not separately captured first/last. */
  characterReferences?: { name: string; mobile?: string }[];
  addresses?: AddressProps[];
}

export class UpdateBorrowerUseCase {
  constructor(
    private readonly deps: { borrowerRepository: IBorrowerRepository; profileActivityLogService?: ProfileActivityLogService },
  ) {}

  async execute(id: string, input: UpdateBorrowerInput, updatedByUserId?: string): Promise<Borrower> {
    const borrower = await this.deps.borrowerRepository.findById(id);
    if (!borrower) {
      throw new NotFoundError('Borrower', id);
    }

    const nameChanged = input.firstName !== undefined || input.lastName !== undefined || input.middleName !== undefined;
    borrower.updateContactDetails({
      name: nameChanged
        ? PersonName.of(input.firstName ?? borrower.name.firstName, input.lastName ?? borrower.name.lastName, input.middleName ?? borrower.name.middleName)
        : undefined,
      suffix: input.suffix,
      gender: input.gender,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      nationality: input.nationality,
      civilStatus: input.civilStatus,
      homeOwnership: input.homeOwnership,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
      facebookLink: input.facebookLink,
    });

    if (input.occupation !== undefined || input.employer !== undefined || input.monthlyIncome !== undefined || input.officeAddress !== undefined) {
      borrower.updateIncomeDetail({
        position: input.occupation,
        employerName: input.employer,
        employerAddress: input.officeAddress,
        monthlyIncome: input.monthlyIncome,
      });
    }

    if (input.tinNumber !== undefined || input.sssNumber !== undefined) {
      borrower.updateGovernmentId({ tinNumber: input.tinNumber, sssNumber: input.sssNumber });
    }

    if (input.dependants !== undefined) {
      borrower.updateDependants(input.dependants);
    }

    if (input.characterReferences !== undefined) {
      borrower.replaceCharacterReferences(
        input.characterReferences
          .filter((r) => r.name.trim())
          .map((r) => ({ firstName: r.name.trim(), lastName: '', phoneNumber: r.mobile?.trim() || undefined })),
      );
    }

    if (input.addresses !== undefined) {
      borrower.replaceAddresses(input.addresses.map((a) => Address.of(a)));
    }

    await this.deps.borrowerRepository.save(borrower);

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService && updatedByUserId) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'BORROWER',
        profileId: borrower.id,
        userId: updatedByUserId,
        action: 'profile_updated',
        details: { fields: Object.keys(input) },
      });
    }

    return borrower;
  }
}
