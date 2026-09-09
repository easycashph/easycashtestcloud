export type AttachmentOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION' | 'CHAT_MESSAGE';

export type AttachmentDocumentCategory =
  | 'PROFILE_PICTURE'
  | 'VALID_ID_BORROWER'
  | 'VALID_ID_CO_BORROWER'
  | 'PROOF_OF_BILLING'
  | 'EMPLOYEE_ID'
  | 'BUSINESS_CLEARANCE'
  | 'CORPORATE_PAYSLIP'
  | 'SEAMANS_BOOK'
  | 'OVERSEAS_EMPLOYMENT_CERTIFICATE'
  | 'DTI_SEC_REGISTRATION'
  | 'BUSINESS_PERMIT'
  | 'INCOME_TAX_RETURN'
  | 'BANK_STATEMENT'
  | 'CERTIFICATE_OF_EMPLOYMENT'
  | 'POEA_CONTRACT'
  | 'ALLOTMENT_SLIP'
  | 'FLIGHT_DETAILS'
  | 'PASSPORT_ID'
  | 'OTHER_SUPPORTING_DOCUMENT'
  | 'PAYMENT_PROOF';

export interface AttachmentRecord {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  documentCategory: AttachmentDocumentCategory | null;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
  /** True when this row came from `migrate-legacy-data.ts` (has a `legacyId`) rather than being
   * uploaded through the app - the only source migrated so far is SDevTech (Mambu's own documents
   * were never recovered, only its loan notes were, via `migrate-mambu-notes.ts`). */
  isLegacyMigrated: boolean;
}

export interface CreateAttachmentInput {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  documentCategory: AttachmentDocumentCategory | null;
  uploadedByUserId: string | null;
}

export interface IAttachmentRepository {
  create(input: CreateAttachmentInput): Promise<AttachmentRecord>;
  findById(id: string): Promise<AttachmentRecord | null>;
  listByOwner(ownerType: AttachmentOwnerType, ownerId: string): Promise<AttachmentRecord[]>;
  /** 2026-09-09 (CRM Report "replace, don't pile up" behavior) - the DB row only; the caller is
   * responsible for also removing the underlying file via `IFileStorage.delete`. */
  delete(id: string): Promise<void>;
}
