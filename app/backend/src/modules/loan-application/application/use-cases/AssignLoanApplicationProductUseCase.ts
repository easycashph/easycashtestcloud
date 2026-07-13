import { NotFoundError } from '@shared/errors/DomainError';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface AssignLoanApplicationProductUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  profileActivityLogService?: ProfileActivityLogService;
}

export class AssignLoanApplicationProductUseCase {
  constructor(private readonly deps: AssignLoanApplicationProductUseCaseDeps) {}

  async execute(id: string, loanProductVersionId: string, assignedByUserId?: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    application.assignProduct(loanProductVersionId);
    await this.deps.loanApplicationRepository.save(application);

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService && assignedByUserId) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: assignedByUserId,
        action: 'product_assigned',
        details: { loanProductVersionId },
      });
    }

    return application;
  }
}
