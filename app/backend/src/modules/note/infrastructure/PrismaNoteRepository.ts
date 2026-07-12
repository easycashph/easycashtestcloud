import { prisma } from '@shared/database/prismaClient';
import type { CreateNoteInput, INoteRepository, NoteOwnerType, NoteRecord } from '../application/ports/INoteRepository';

export class PrismaNoteRepository implements INoteRepository {
  async create(input: CreateNoteInput): Promise<NoteRecord> {
    const row = await prisma.note.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        text: input.text,
        authorUserId: input.authorUserId,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return this.toRecord(row);
  }

  async listByOwner(ownerType: NoteOwnerType, ownerId: string): Promise<NoteRecord[]> {
    const rows = await prisma.note.findMany({
      where: { ownerType, ownerId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: {
    id: string;
    ownerType: string;
    ownerId: string;
    text: string;
    authorUserId: string;
    author: { firstName: string; lastName: string } | null;
    createdAt: Date;
  }): NoteRecord {
    return {
      id: row.id,
      ownerType: row.ownerType as NoteOwnerType,
      ownerId: row.ownerId,
      text: row.text,
      authorUserId: row.authorUserId,
      authorName: row.author ? `${row.author.firstName} ${row.author.lastName}` : null,
      createdAt: row.createdAt,
    };
  }
}
