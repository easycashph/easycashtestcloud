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
  civilStatus?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
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
      civilStatus: input.civilStatus,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
    });

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
