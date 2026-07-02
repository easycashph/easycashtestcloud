import { CoBorrower } from '../../domain/CoBorrower';
import { PersonName } from '../../domain/valueObjects/PersonName';
import type { ICoBorrowerRepository } from '../ports/ICoBorrowerRepository';
import type { CreateCoBorrowerInput } from '../dtos/BorrowerDtos';

export interface CreateCoBorrowerUseCaseDeps {
  coBorrowerRepository: ICoBorrowerRepository;
}

/** ADR-015 (per-borrower vs. per-loan scope) is open — this use case only creates the person record; attaching it to a LoanAccount is a loan-account-module concern (LoanAccountCoBorrower join). */
export class CreateCoBorrowerUseCase {
  constructor(private readonly deps: CreateCoBorrowerUseCaseDeps) {}

  async execute(input: CreateCoBorrowerInput): Promise<CoBorrower> {
    const coBorrower = CoBorrower.create({
      name: PersonName.of(input.firstName, input.lastName, input.middleName),
      gender: input.gender,
      civilStatus: input.civilStatus,
      birthDate: input.birthDate,
      phoneNumber: input.phoneNumber,
      emailAddress: input.emailAddress,
      relationship: input.relationship,
      legacyId: input.legacyId,
    });

    await this.deps.coBorrowerRepository.save(coBorrower);
    return coBorrower;
  }
}
