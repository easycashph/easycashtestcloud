import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface DeleteLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

/** MIS-only — role gating happens at the router (requirePermission), not here. Hard delete: unlike
 * financial ledger entities (LoanTransaction etc.), a LoanApplication that hasn't yet produced a
 * Borrower/LoanAccount carries no money movement, so there's no TXN-1-style append-only concern.
 * Blocked once it HAS produced one of those, since Borrower.sourceApplicationId /
 * LoanAccount.sourceApplicationId are ON DELETE SET NULL — deleting past that point would silently
 * orphan a real client/loan record instead of failing loudly. */
export class DeleteLoanApplicationUseCase {
  constructor(private readonly deps: DeleteLoanApplicationUseCaseDeps) {}

  async execute(id: string, deletedByUserId: string): Promise<void> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const hasDownstreamRecords = await this.deps.loanApplicationRepository.hasDownstreamRecords(id);
    if (hasDownstreamRecords) {
      throw new ValidationError(
        'This application already has a client profile or loan account created from it and can no longer be deleted.',
      );
    }

    const snapshot = application.toProps();
    await this.deps.loanApplicationRepository.delete(id);
    await this.deps.auditLogger.log({
      userId: deletedByUserId,
      action: 'DELETE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: id,
      previousValue: snapshot,
      newValue: null,
    });
  }
}
