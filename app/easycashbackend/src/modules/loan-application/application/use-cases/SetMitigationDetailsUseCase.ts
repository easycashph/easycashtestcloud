import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { LoanApplication, MitigationDetails } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface SetMitigationDetailsUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

/** 2026-08-10 (user request) - generalizes `SetMitigationAccountOwnerUseCase` to every mitigation
 * field, same status-unrestricted reasoning: see `LoanApplication.setMitigationDetails()`'s doc
 * comment. Lets MIS/CRM correct a surrendered ATM/allotment account's bank/branch/account
 * number/ATM card number even on an already-Active loan. */
export class SetMitigationDetailsUseCase {
  constructor(private readonly deps: SetMitigationDetailsUseCaseDeps) {}

  async execute(id: string, submittedByUserId: string, patch: Partial<MitigationDetails>): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) throw new NotFoundError('LoanApplication', id);

    application.setMitigationDetails(patch);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: submittedByUserId,
      action: 'SET_MITIGATION_DETAILS',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: undefined,
      newValue: patch,
    });

    return application;
  }
}
