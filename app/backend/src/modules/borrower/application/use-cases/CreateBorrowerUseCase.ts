import { Borrower } from '../../domain/Borrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';
import type { CreateBorrowerInput } from '../dtos/BorrowerDtos';

export interface CreateBorrowerUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
}

/**
 * Structural creation only — BOR-1..4. Duplicate-detection (ADR-012) is
 * explicitly deferred; this use case does not attempt to infer or enforce
 * any matching rule that hasn't been confirmed.
 */
export class CreateBorrowerUseCase {
  constructor(private readonly deps: CreateBorrowerUseCaseDeps) {}

  async execute(input: CreateBorrowerInput): Promise<Borrower> {
    const borrower = Borrower.create({
      branchId: input.branchId,
      assignedLoanOfficerId: input.assignedLoanOfficerId,
      name: PersonName.of(input.firstName, input.lastName, input.middleName),
      gender: input.gender,
      birthDate: input.birthDate,
      civilStatus: input.civilStatus,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
      legacyId: input.legacyId,
    });

    await this.deps.borrowerRepository.save(borrower);
    return borrower;
  }
}
