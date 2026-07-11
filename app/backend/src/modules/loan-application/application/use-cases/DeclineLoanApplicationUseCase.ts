import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface DeclineLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

export class DeclineLoanApplicationUseCase {
  constructor(private readonly deps: DeclineLoanApplicationUseCaseDeps) {}

  async execute(id: string, reviewedByUserId: string, decisionNote: string | undefined): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.decline(reviewedByUserId, decisionNote);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: reviewedByUserId,
      action: 'DECLINE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'DECLINED', decisionNote },
    });

    return application;
  }
}
