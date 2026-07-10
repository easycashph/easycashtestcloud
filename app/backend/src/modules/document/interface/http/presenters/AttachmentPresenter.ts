import type { AttachmentRecord } from '../../../application/ports/IAttachmentRepository';

export interface AttachmentResponse {
  id: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
}

export function presentAttachment(record: AttachmentRecord): AttachmentResponse {
  return {
    id: record.id,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    fileName: record.fileName,
    fileType: record.fileType,
    fileSize: record.fileSize,
    uploadedByUserId: record.uploadedByUserId,
    uploadedByName: record.uploadedByName,
    uploadedAt: record.uploadedAt.toISOString(),
  };
}
