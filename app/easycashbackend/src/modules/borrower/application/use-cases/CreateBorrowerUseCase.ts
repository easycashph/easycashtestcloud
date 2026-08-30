import { randomUUID } from 'node:crypto';
import { Borrower } from '../../domain/Borrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import { Address } from '../../domain/valueObjects/Address';
import { DuplicateClientProfileError } from '../../domain/errors/BorrowerDomainErrors';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';
import type { CreateBorrowerInput } from '../dtos/BorrowerDtos';

export interface CreateBorrowerUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  profileActivityLogService?: ProfileActivityLogService;
  /** Both optional and only used together (2026-07-24, Phase D): when Create Client Profile runs
   * from an application that carries a `portalAccountId` (i.e. was submitted through the Easycash
   * Portal, not staff-encoded), links that PortalAccount to the newly-created Borrower so the
   * portal user can see/edit their own client profile. Silently skipped if either dep is missing
   * or the source application has no portalAccountId - staff-encoded applications never link. */
  loanApplicationRepository?: ILoanApplicationRepository;
  portalAccountRepository?: IPortalAccountRepository;
}

/**
 * Structural creation only — BOR-1..4. Duplicate-detection (ADR-012) is
 * explicitly deferred; this use case does not attempt to infer or enforce
 * any matching rule that hasn't been confirmed.
 */
export class CreateBorrowerUseCase {
  constructor(private readonly deps: CreateBorrowerUseCaseDeps) {}

  async execute(input: CreateBorrowerInput, createdByUserId?: string): Promise<Borrower> {
    // 2026-07-14: an approved LoanApplication can only ever produce one Client Profile - checked
    // proactively (not just left to the DB's @unique constraint) so a duplicate attempt gets a
    // clean 409 instead of a generic 500. See DuplicateClientProfileError's own doc comment.
    if (input.sourceApplicationId) {
      const existing = await this.deps.borrowerRepository.findBySourceApplicationId(input.sourceApplicationId);
      if (existing) throw new DuplicateClientProfileError(input.sourceApplicationId);
    }

    const borrower = Borrower.create({
      branchId: input.branchId,
      assignedLoanOfficerId: input.assignedLoanOfficerId,
      name: PersonName.of(input.firstName, input.lastName, input.middleName),
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
      dependants: input.dependants,
      note: input.note,
      legacyId: input.legacyId,
      sourceApplicationId: input.sourceApplicationId,
      incomeDetail: input.incomeDetail,
      governmentId: input.governmentId,
      characterReferences: input.characterReferences?.map((ref) => ({ id: randomUUID(), ...ref, lastName: ref.lastName ?? '' })),
      addresses: input.addresses?.map((addr) => Address.of(addr)),
    });

    await this.deps.borrowerRepository.save(borrower);

    // CIC monthly report (2026-08-30, user-confirmed): every genuinely new client gets a permanent
    // Provider Subject No the moment their profile exists - see IBorrowerRepository's own doc
    // comment for why this only happens here (not for legacy-migrated borrowers).
    await this.deps.borrowerRepository.assignCicProviderSubjectNoIfMissing(borrower.id);

    // Phase D (2026-07-24): link the originating PortalAccount to this Borrower, if any.
    if (input.sourceApplicationId && this.deps.loanApplicationRepository && this.deps.portalAccountRepository) {
      const sourceApplication = await this.deps.loanApplicationRepository.findById(input.sourceApplicationId);
      if (sourceApplication?.portalAccountId) {
        await this.deps.portalAccountRepository.update(sourceApplication.portalAccountId, { borrowerId: borrower.id });
      }
    }

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService && createdByUserId) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'BORROWER',
        profileId: borrower.id,
        userId: createdByUserId,
        action: 'profile_created',
        details: {},
      });
    }

    return borrower;
  }
}
