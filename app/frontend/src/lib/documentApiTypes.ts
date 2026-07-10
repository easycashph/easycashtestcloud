/** Mirrors `app/backend`'s `AttachmentPresenter.presentAttachment()` JSON shape. */
export type AttachmentOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

export interface Attachment {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
}
