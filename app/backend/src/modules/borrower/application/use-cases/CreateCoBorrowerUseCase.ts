import { CoBorrower } from '../../domain/CoBorrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { ICoBorrowerRepository } from '../ports/ICoBorrowerRepository';
import type { CreateCoBorrowerInput } from '../dtos/BorrowerDtos';

export interface CreateCoBorrowerUseCaseDeps {
  coBorrowerRepository: ICoBorrowerRepository;
  auditLogger?: IAuditLogger;
}

/**
 * ADR-015 RESOLVED (2026-07-16): per-Borrower — `input.borrowerId`, when supplied, attaches this
 * co-borrower directly to a client, visible on every one of their loans. Still optional (not
 * required) since the standalone `POST /co-borrowers` endpoint predates this resolution and some
 * callers may still be attaching purely via the legacy `LoanAccountCoBorrower` join instead.
 */
export class CreateCoBorrowerUseCase {
  constructor(private readonly deps: CreateCoBorrowerUseCaseDeps) {}

  async execute(input: CreateCoBorrowerInput, createdByUserId?: string): Promise<CoBorrower> {
    const coBorrower = CoBorrower.create({
      borrowerId: input.borrowerId,
      name: PersonName.of(input.firstName, input.lastName, input.middleName),
      gender: input.gender,
      civilStatus: input.civilStatus,
      birthDate: input.birthDate,
      phoneNumber: input.phoneNumber,
      emailAddress: input.emailAddress,
      relationship: input.relationship,
      employer: input.employer,
      legacyId: input.legacyId,
    });

    await this.deps.coBorrowerRepository.save(coBorrower);

    if (this.deps.auditLogger && createdByUserId) {
      await this.deps.auditLogger.log({
        userId: createdByUserId,
        action: 'CREATE_CO_BORROWER',
        entityType: 'CoBorrower',
        entityId: coBorrower.id,
        newValue: { name: `${input.firstName} ${input.lastName}`, relationship: input.relationship ?? null },
      });
    }

    return coBorrower;
  }
}
