import { NotFoundError } from '@shared/errors/DomainError';
import type { CoBorrower } from '../../domain/CoBorrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import { Address } from '../../domain/valueObjects/Address';
import type { ICoBorrowerRepository } from '../ports/ICoBorrowerRepository';
import type { UpdateCoBorrowerInput } from '../dtos/BorrowerDtos';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';

export interface UpdateCoBorrowerUseCaseDeps {
  coBorrowerRepository: ICoBorrowerRepository;
  auditLogger?: IAuditLogger;
}

export class UpdateCoBorrowerUseCase {
  constructor(private readonly deps: UpdateCoBorrowerUseCaseDeps) {}

  async execute(id: string, input: UpdateCoBorrowerInput, updatedByUserId?: string): Promise<CoBorrower> {
    const coBorrower = await this.deps.coBorrowerRepository.findById(id);
    if (!coBorrower) {
      throw new NotFoundError('CoBorrower', id);
    }

    const nameChanged = input.firstName !== undefined || input.lastName !== undefined || input.middleName !== undefined;
    coBorrower.updateDetails({
      name: nameChanged
        ? PersonName.of(
            input.firstName ?? coBorrower.name.firstName,
            input.lastName ?? coBorrower.name.lastName,
            input.middleName ?? coBorrower.name.middleName,
          )
        : undefined,
      gender: input.gender,
      civilStatus: input.civilStatus,
      birthDate: input.birthDate,
      phoneNumber: input.phoneNumber,
      emailAddress: input.emailAddress,
      relationship: input.relationship,
      employer: input.employer,
    });

    if (input.addresses !== undefined) {
      coBorrower.replaceAddresses(input.addresses.map((a) => Address.of(a)));
    }

    await this.deps.coBorrowerRepository.save(coBorrower);

    if (this.deps.auditLogger && updatedByUserId) {
      await this.deps.auditLogger.log({
        userId: updatedByUserId,
        action: 'UPDATE_CO_BORROWER',
        entityType: 'CoBorrower',
        entityId: coBorrower.id,
        newValue: { fields: Object.keys(input) },
      });
    }

    return coBorrower;
  }
}
