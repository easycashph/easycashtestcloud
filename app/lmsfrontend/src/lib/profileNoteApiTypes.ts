/** Mirrors `app/backend`'s `ProfileNotePresenter.presentProfileNote()` JSON shape. Renamed from
 * `noteApiTypes.ts` (2026-07-13). */
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
