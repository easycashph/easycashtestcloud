import { CreateLoanApplicationUseCase } from '@modules/loan-application/application/use-cases/CreateLoanApplicationUseCase';
import type { LoanApplication } from '@modules/loan-application/domain/LoanApplication';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { SubmitLoanApplicationInput } from '../dtos/PortalLoanApplicationDtos';
import { PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface SubmitLoanApplicationUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  createLoanApplicationUseCase: CreateLoanApplicationUseCase;
}

/** Wraps loan-application's own CreateLoanApplicationUseCase rather than duplicating its
 * pre-qualification/notification/in-flight-check logic - a portal submission is still just a
 * LoanApplication, distinguished only by `portalAccountId` and (for a repeat client whose earlier
 * application was already converted) `borrowerId`. Fills contact fields from the account if the
 * client left them blank on the form, since we already know their email/mobile from signup. */
export class SubmitLoanApplicationUseCase {
  constructor(private readonly deps: SubmitLoanApplicationUseCaseDeps) {}

  async execute(portalAccountId: string, input: SubmitLoanApplicationInput): Promise<LoanApplication> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    return this.deps.createLoanApplicationUseCase.execute({
      ...input,
      borrowerId: account.borrowerId ?? undefined,
      portalAccountId: account.id,
      email: input.email ?? account.email,
      mobilePhone: input.mobilePhone ?? account.contactNumber ?? undefined,
    });
  }
}
