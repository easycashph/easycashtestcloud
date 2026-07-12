/** Mirrors `app/backend`'s `NotePresenter.presentNote()` JSON shape. */
export type NoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface Note {
  id: string;
  ownerType: NoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
  authorName: string | null;
  createdAt: string;
}

/** Body for `POST /notes`. */
export interface CreateNoteRequest {
  ownerType: NoteOwnerType;
  ownerId: string;
  text: string;
}
