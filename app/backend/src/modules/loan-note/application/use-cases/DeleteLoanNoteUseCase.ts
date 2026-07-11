import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { ILoanNoteRepository } from '../ports/ILoanNoteRepository';

export interface DeleteLoanNoteUseCaseDeps {
  loanNoteRepository: ILoanNoteRepository;
  auditLogger: IAuditLogger;
}

/**
 * 2026-07-11 (user request): MIS-only (role gating happens at the router, not here, same
 * precedent as `RevertLoanApplicationDecisionUseCase`) — permanently deletes a note, unlike every
 * other append-only record in this system. The deleted note's content is preserved in the audit
 * log's `previousValue` (via `IAuditLogger`, the same non-financial audit trail used for loan
 * application decisions) so there's still a record of what was removed, by whom, and when — even
 * though the `loan_notes` row itself is gone for good.
 */
export class DeleteLoanNoteUseCase {
  constructor(private readonly deps: DeleteLoanNoteUseCaseDeps) {}

  async execute(loanAccountId: string, noteId: string, deletedByUserId: string): Promise<void> {
    const note = await this.deps.loanNoteRepository.findById(noteId);
    if (!note || note.loanAccountId !== loanAccountId) {
      throw new NotFoundError('LoanNote', noteId);
    }

    await this.deps.loanNoteRepository.delete(noteId);
    await this.deps.auditLogger.log({
      userId: deletedByUserId,
      action: 'DELETE_LOAN_NOTE',
      entityType: 'LoanNote',
      entityId: note.id,
      previousValue: { loanAccountId: note.loanAccountId, authorUserId: note.authorUserId, text: note.text, createdAt: note.createdAt.toISOString() },
      newValue: undefined,
    });
  }
}
