import type { AttachmentDocumentCategory } from './ports/IAttachmentRepository';

/** Plain-language folder names for `Attachment.documentCategory`, used to organize a bulk ZIP
 * download (2026-08-20) into readable subfolders instead of one flat pile of files. */
const CATEGORY_LABELS: Record<AttachmentDocumentCategory, string> = {
  PROFILE_PICTURE: 'Profile Picture',
  VALID_ID_BORROWER: 'Valid ID - Borrower',
  VALID_ID_CO_BORROWER: 'Valid ID - Co-Borrower',
  PROOF_OF_BILLING: 'Proof of Billing',
  EMPLOYEE_ID: 'Employee ID',
  BUSINESS_CLEARANCE: 'Business Clearance',
  CORPORATE_PAYSLIP: 'Payslip',
  SEAMANS_BOOK: "Seaman's Book",
  OVERSEAS_EMPLOYMENT_CERTIFICATE: 'Overseas Employment Certificate',
  DTI_SEC_REGISTRATION: 'DTI-SEC Registration Certificate',
  BUSINESS_PERMIT: "Mayor's-Business Permit",
  INCOME_TAX_RETURN: 'Income Tax Return (ITR) - Financial Statements',
  BANK_STATEMENT: 'Bank Statement',
  CERTIFICATE_OF_EMPLOYMENT: 'Certificate of Employment (COE)',
  POEA_CONTRACT: 'POEA Contract of Employment',
  ALLOTMENT_SLIP: 'Allotment Slip - Certificate of Salary and Allowance (CSA)',
  FLIGHT_DETAILS: 'Flight Details-Guarantee Letter',
  PASSPORT_ID: 'Passport ID',
  OTHER_SUPPORTING_DOCUMENT: 'Other Supporting Document',
  PAYMENT_PROOF: 'Payment Proof',
};

export function documentCategoryLabel(category: AttachmentDocumentCategory | null): string {
  return category ? CATEGORY_LABELS[category] : 'Other';
}
