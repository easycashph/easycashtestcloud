/**
 * Renamed from the original `note` module (2026-07-13) - a simple, undeletable running log shared
 * across Borrower/LoanAccount/LoanApplication profiles, mirroring the existing
 * `ProfileActivityLog` naming convention for "spans multiple profile types". The once-parallel
 * `loan-note` module (loan-account-only, MIS-deletable, audit-trailed) was never wired to any
 * frontend page and was removed as dead code 2026-07-21.
 */
export type ProfileNoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

/** 2026-08-29 (user request, "pwede ba malaman kung galing Mambu o SDevTech ang note na ito"):
 * derived from `legacyId`'s own shape, not a stored column - `migrate-mambu-notes.ts` prefixes its
 * rows `mambu:<encodedkey>`, `migrate-legacy-data.ts`'s SDevTech "comments" migration stores the
 * raw Mongo id with no prefix, and a note created through the app itself has no `legacyId` at all.
 * Shown next to the "Unknown" author fallback so a migrated note's real (if unidentified) origin is
 * never conflated with "we don't know where this came from at all". */
export type ProfileNoteSource = 'SDEVTECH' | 'MAMBU' | 'NATIVE';

export interface ProfileNoteRecord {
  id: string;
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  /** Nullable only for legacy-migrated notes (SDevTech "comments" collection, no corresponding
   * User record) - always set for a note created through the app itself. */
  authorUserId: string | null;
  authorName: string | null;
  source: ProfileNoteSource;
  createdAt: Date;
}

export interface CreateProfileNoteInput {
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
}

export interface IProfileNoteRepository {
  create(input: CreateProfileNoteInput): Promise<ProfileNoteRecord>;
  listByOwner(ownerType: ProfileNoteOwnerType, ownerId: string): Promise<ProfileNoteRecord[]>;
}
