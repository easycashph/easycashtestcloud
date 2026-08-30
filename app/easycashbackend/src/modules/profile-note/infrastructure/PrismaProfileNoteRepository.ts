import { prisma } from '@shared/database/prismaClient';
import type {
  CreateProfileNoteInput,
  IProfileNoteRepository,
  ProfileNoteOwnerType,
  ProfileNoteRecord,
  ProfileNoteSource,
} from '../application/ports/IProfileNoteRepository';

function sourceOf(legacyId: string | null): ProfileNoteSource {
  if (!legacyId) return 'NATIVE';
  return legacyId.startsWith('mambu:') ? 'MAMBU' : 'SDEVTECH';
}

export class PrismaProfileNoteRepository implements IProfileNoteRepository {
  async create(input: CreateProfileNoteInput): Promise<ProfileNoteRecord> {
    const row = await prisma.profileNote.create({
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

  async listByOwner(ownerType: ProfileNoteOwnerType, ownerId: string): Promise<ProfileNoteRecord[]> {
    const rows = await prisma.profileNote.findMany({
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
    authorUserId: string | null;
    author: { firstName: string; lastName: string } | null;
    legacyId?: string | null;
    createdAt: Date;
  }): ProfileNoteRecord {
    return {
      id: row.id,
      ownerType: row.ownerType as ProfileNoteOwnerType,
      ownerId: row.ownerId,
      text: row.text,
      authorUserId: row.authorUserId,
      authorName: row.author ? `${row.author.firstName} ${row.author.lastName}` : null,
      source: sourceOf(row.legacyId ?? null),
      createdAt: row.createdAt,
    };
  }
}
