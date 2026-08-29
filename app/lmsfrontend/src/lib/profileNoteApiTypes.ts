/** Mirrors `app/backend`'s `ProfileNotePresenter.presentProfileNote()` JSON shape. Renamed from
 * `noteApiTypes.ts` (2026-07-13). */
export type ProfileNoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

/** 2026-08-29 (user request) - derived from the note's legacyId shape, not stored separately.
 * Shown next to the "Unknown" author fallback so a migrated note's origin is never conflated with
 * "we don't know anything about where this came from". */
export type ProfileNoteSource = 'SDEVTECH' | 'MAMBU' | 'NATIVE';

export interface ProfileNote {
  id: string;
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  /** Null only for legacy-migrated notes (SDevTech "comments" collection) - always set for a note
   * created through the app itself. */
  authorUserId: string | null;
  authorName: string | null;
  source: ProfileNoteSource;
  createdAt: string;
}

/** Body for `POST /profile-notes`. */
export interface CreateProfileNoteRequest {
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
}
