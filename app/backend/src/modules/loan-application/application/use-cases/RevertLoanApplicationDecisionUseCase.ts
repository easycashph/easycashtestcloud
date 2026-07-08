import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface RevertLoanApplicationDecisionUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

/** MIS-only — role gating happens at the router (requireRole), not here; this use case only knows the state transition. */
export class RevertLoanApplicationDecisionUseCase {
  constructor(private readonly deps: RevertLoanApplicationDecisionUseCaseDeps) {}

  async execute(id: string, revertedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.revert();
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: revertedByUserId,
      action: 'REVERT_LOAN_APPLICATION_DECISION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'PENDING_REVIEW' },
    });

    return application;
  }
}
