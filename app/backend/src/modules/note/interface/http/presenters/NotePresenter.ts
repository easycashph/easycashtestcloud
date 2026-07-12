import type { NoteRecord } from '../../../application/ports/INoteRepository';

export interface NoteResponse {
  id: string;
  ownerType: string;
  ownerId: string;
  text: string;
  authorUserId: string;
  authorName: string | null;
  createdAt: string;
}

export function presentNote(record: NoteRecord): NoteResponse {
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
