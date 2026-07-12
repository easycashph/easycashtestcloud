export type NoteOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface NoteRecord {
  id: string;
  ownerType: NoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
  authorName: string | null;
  createdAt: Date;
}

export interface CreateNoteInput {
  ownerType: NoteOwnerType;
  ownerId: string;
  text: string;
  authorUserId: string;
}

export interface INoteRepository {
  create(input: CreateNoteInput): Promise<NoteRecord>;
  listByOwner(ownerType: NoteOwnerType, ownerId: string): Promise<NoteRecord[]>;
}
