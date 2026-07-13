/**
 * Renamed from the original `note` module (2026-07-13) to disambiguate from the separate
 * `loan-note` module (Nomer's session, `/loan-accounts/:id/notes`) that coexists in this backend -
 * that one is loan-account-only, MIS-deletable, and audit-trailed; this one is a simple,
 * undeletable running log shared across Borrower/LoanAccount/LoanApplication profiles, mirroring
 * the existing `ProfileActivityLog` naming convention for "spans multiple profile types".
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
