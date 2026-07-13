/** Mirrors `app/backend`'s `ProfileNotePresenter.presentProfileNote()` JSON shape. Renamed from
 * `noteApiTypes.ts` (2026-07-13) to disambiguate from the separate `loan-note` module's own,
 * differently-capable notes (loan-account-only, MIS-deletable, audit-trailed). */
export type ProfileNoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface ProfileNote {
  id: string;
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
  authorName: string | null;
  createdAt: string;
}

/** Body for `POST /profile-notes`. */
export interface CreateProfileNoteRequest {
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
}
