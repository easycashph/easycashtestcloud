import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface SetMitigationAccountOwnerUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

/** 2026-07-29 - narrow companion to `SubmitLoanApplicationReviewReportUseCase`, deliberately usable
 * regardless of the application's status (see `LoanApplication.setMitigationAccountOwner()`'s own
 * doc comment for why). Lets MIS/CRM retroactively record whose name a surrendered ATM/allotment
 * account is under even on an already-Active loan, so `CreateLoanSigningSessionUseCase` can decide
 * which Deed of Assignment document applies. */
export class SetMitigationAccountOwnerUseCase {
  constructor(private readonly deps: SetMitigationAccountOwnerUseCaseDeps) {}

  async execute(id: string, submittedByUserId: string, accountOwner: 'BORROWER' | 'CO_BORROWER'): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) throw new NotFoundError('LoanApplication', id);

    application.setMitigationAccountOwner(accountOwner);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: submittedByUserId,
      action: 'SET_MITIGATION_ACCOUNT_OWNER',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: undefined,
      newValue: { accountOwner },
    });

    return application;
  }
}
