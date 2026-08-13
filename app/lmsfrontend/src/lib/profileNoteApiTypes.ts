/** Mirrors `app/backend`'s `ProfileNotePresenter.presentProfileNote()` JSON shape. Renamed from
 * `noteApiTypes.ts` (2026-07-13). */
export type ProfileNoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface ProfileNote {
  id: string;
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  /** Null only for legacy-migrated notes (SDevTech "comments" collection) - always set for a note
   * created through the app itself. */
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
}

/** Body for `POST /profile-notes`. */
export interface CreateProfileNoteRequest {
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
}
