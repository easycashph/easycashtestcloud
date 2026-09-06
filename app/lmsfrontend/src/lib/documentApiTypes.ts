/** Mirrors `app/backend`'s `AttachmentPresenter.presentAttachment()` JSON shape. */
export type AttachmentOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' | 'LOAN_APPLICATION';

/** Mirrors `app/backend`'s `AttachmentDocumentCategory` Prisma enum. */
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

/** Single source of truth for how each category reads in the UI - reused by the Loan Application
 * create form's upload slots and by `AttachmentsPanel`'s display. */
export const DOCUMENT_CATEGORY_LABELS: Record<AttachmentDocumentCategory, string> = {
  PROFILE_PICTURE: 'Profile picture',
  VALID_ID_BORROWER: 'Valid ID (Borrower)',
  VALID_ID_CO_BORROWER: 'Valid ID (Co-Borrower)',
  PROOF_OF_BILLING: 'Proof of billing',
  EMPLOYEE_ID: 'Employee ID',
  BUSINESS_CLEARANCE: 'Business clearance',
  CORPORATE_PAYSLIP: 'Corporate payslip',
  SEAMANS_BOOK: "Seaman's book",
  OVERSEAS_EMPLOYMENT_CERTIFICATE: 'Overseas Employment Certificate',
  DTI_SEC_REGISTRATION: 'DTI/SEC Registration Certificate',
  BUSINESS_PERMIT: "Mayor's/Business Permit",
  INCOME_TAX_RETURN: 'Income Tax Return (ITR) / Financial Statements',
  BANK_STATEMENT: 'Bank Statement',
  CERTIFICATE_OF_EMPLOYMENT: 'Certificate of Employment (COE)',
  POEA_CONTRACT: 'POEA Contract of Employment',
  ALLOTMENT_SLIP: 'Allotment Slip / Certificate of Salary and Allowance (CSA)',
  FLIGHT_DETAILS: 'Flight Details / Guarantee Letter',
  PASSPORT_ID: 'Passport ID',
  OTHER_SUPPORTING_DOCUMENT: 'Other',
  PAYMENT_PROOF: 'Payment Proof',
};

export interface Attachment {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentCategory: AttachmentDocumentCategory | null;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  /** True when this row came from the SDevTech migration rather than an upload through the app. */
  isLegacyMigrated: boolean;
}

/** Shared with the Loan Application create form's categorized document slots - same whitelist and
 * limit the backend's `UploadAttachmentUseCase` enforces server-side. */
export const ATTACHMENT_ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png';
export const ATTACHMENT_ACCEPTED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const ATTACHMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
