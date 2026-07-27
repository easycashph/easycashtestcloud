import { NotFoundError } from '@shared/errors/DomainError';
import type { Borrower } from '@modules/borrower/domain/Borrower';
import { UpdateBorrowerUseCase } from '@modules/borrower/application/use-cases/UpdateBorrowerUseCase';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import { PortalAccountNotLinkedError } from '../../domain/errors/PortalAuthErrors';
import type { UpdatePortalProfileInput } from '../dtos/PortalProfileDtos';

/**
 * Phase D (2026-07-24 user request): lets a linked portal client edit their own contact info
 * (mobile, email, present address) directly on the real `Borrower` record the LMS uses - delegates
 * to the same `UpdateBorrowerUseCase` staff use, just called with an input restricted to the
 * confirmed self-service scope, so the write path (and its ADR-050 activity logging) is identical
 * either way.
 */
export class UpdatePortalProfileUseCase {
  constructor(
    private readonly deps: { portalAccountRepository: IPortalAccountRepository; updateBorrowerUseCase: UpdateBorrowerUseCase },
  ) {}

  async execute(portalAccountId: string, input: UpdatePortalProfileInput): Promise<Borrower> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account) {
      throw new NotFoundError('PortalAccount', portalAccountId);
    }
    if (!account.borrowerId) {
      throw new PortalAccountNotLinkedError();
    }

    return this.deps.updateBorrowerUseCase.execute(account.borrowerId, {
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
  }
}
