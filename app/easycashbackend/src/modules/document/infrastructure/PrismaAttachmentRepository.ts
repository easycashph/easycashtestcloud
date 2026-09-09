import { prisma } from '@shared/database/prismaClient';
import type {
  AttachmentDocumentCategory,
  AttachmentOwnerType,
  AttachmentRecord,
  CreateAttachmentInput,
  IAttachmentRepository,
} from '../application/ports/IAttachmentRepository';

export class PrismaAttachmentRepository implements IAttachmentRepository {
  async create(input: CreateAttachmentInput): Promise<AttachmentRecord> {
    const row = await prisma.attachment.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        storageKey: input.storageKey,
        documentCategory: input.documentCategory,
        uploadedByUserId: input.uploadedByUserId,
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<AttachmentRecord | null> {
    const row = await prisma.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    return row ? this.toRecord(row) : null;
  }

  async listByOwner(ownerType: AttachmentOwnerType, ownerId: string): Promise<AttachmentRecord[]> {
    const rows = await prisma.attachment.findMany({
      where: { ownerType, ownerId },
      orderBy: { uploadedAt: 'desc' },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async delete(id: string): Promise<void> {
    await prisma.attachment.delete({ where: { id } });
  }

  private toRecord(row: {
    id: string;
    ownerType: string;
    ownerId: string;
    fileName: string;
    fileType: string;
    fileSize: number | null;
    storageKey: string;
    documentCategory: string | null;
    uploadedByUserId: string | null;
    uploadedBy: { firstName: string; lastName: string } | null;
    uploadedAt: Date;
    legacyId: string | null;
  }): AttachmentRecord {
    return {
      id: row.id,
      ownerType: row.ownerType as AttachmentOwnerType,
      ownerId: row.ownerId,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize ?? 0,
      storageKey: row.storageKey,
      documentCategory: row.documentCategory as AttachmentDocumentCategory | null,
      uploadedByUserId: row.uploadedByUserId,
      uploadedByName: row.uploadedBy ? `${row.uploadedBy.firstName} ${row.uploadedBy.lastName}` : null,
      uploadedAt: row.uploadedAt,
      isLegacyMigrated: row.legacyId !== null,
    };
  }
}
