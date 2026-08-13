import type { ProfileNoteRecord } from '../../../application/ports/IProfileNoteRepository';

export interface ProfileNoteResponse {
  id: string;
  ownerType: string;
  ownerId: string;
  text: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
}

export function presentProfileNote(record: ProfileNoteRecord): ProfileNoteResponse {
  return {
    id: record.id,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    text: record.text,
    authorUserId: record.authorUserId,
    authorName: record.authorName,
    createdAt: record.createdAt.toISOString(),
  };
}
