/**
 * Renamed from the original `note` module (2026-07-13) - a simple, undeletable running log shared
 * across Borrower/LoanAccount/LoanApplication profiles, mirroring the existing
 * `ProfileActivityLog` naming convention for "spans multiple profile types". The once-parallel
 * `loan-note` module (loan-account-only, MIS-deletable, audit-trailed) was never wired to any
 * frontend page and was removed as dead code 2026-07-21.
 */
export type ProfileNoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface ProfileNoteRecord {
  id: string;
  ownerType: ProfileNoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
  authorName: string | null;
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
