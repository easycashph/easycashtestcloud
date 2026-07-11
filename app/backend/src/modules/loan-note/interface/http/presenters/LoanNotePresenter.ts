import type { LoanNote } from '../../../domain/LoanNote';
import type { LoanNoteView } from '../../../application/ports/ILoanNoteRepository';

/** For the create endpoint's response — no authorName available here (no join on a fresh write); the frontend already knows its own current user's name. */
export function presentLoanNote(note: LoanNote) {
  return {
    id: note.id,
    loanAccountId: note.loanAccountId,
    authorUserId: note.authorUserId,
    text: note.text,
    createdAt: note.createdAt.toISOString(),
  };
}

export function presentLoanNoteView(view: LoanNoteView) {
  return {
    id: view.id,
    loanAccountId: view.loanAccountId,
    authorUserId: view.authorUserId,
    authorName: view.authorName,
    text: view.text,
    createdAt: view.createdAt.toISOString(),
  };
}
