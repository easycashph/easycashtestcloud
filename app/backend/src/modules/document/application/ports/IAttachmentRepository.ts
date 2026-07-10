export type AttachmentOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface AttachmentRecord {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
}

export interface CreateAttachmentInput {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  uploadedByUserId: string | null;
}

export interface IAttachmentRepository {
  create(input: CreateAttachmentInput): Promise<AttachmentRecord>;
  findById(id: string): Promise<AttachmentRecord | null>;
  listByOwner(ownerType: AttachmentOwnerType, ownerId: string): Promise<AttachmentRecord[]>;
}
