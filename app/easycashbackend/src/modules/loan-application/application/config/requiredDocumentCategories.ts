import type { AttachmentDocumentCategory } from '@modules/document/application/ports/IAttachmentRepository';

/**
 * Mirrors the Portal frontend's DOCUMENT_SLOTS `showWhen` logic (app/portalfrontend/src/lib/
 * loanRequirements.ts) — the categories a loan application is expected to attach before it's
 * considered "complete" for the Portal dashboard's missing-documents indicator (2026-07-31 user
 * request). OTHER_SUPPORTING_DOCUMENT and PROFILE_PICTURE are deliberately excluded — always
 * optional/supplementary, never required. FLIGHT_DETAILS (2026-09-06) is also excluded — the
 * Portal's own published checklist lists it as "if available", not a hard requirement.
 */
export function getRequiredDocumentCategories(requestedCategory: string, hasCoBorrower: boolean): AttachmentDocumentCategory[] {
  const categories: AttachmentDocumentCategory[] = ['VALID_ID_BORROWER', 'PROOF_OF_BILLING'];
  if (hasCoBorrower) categories.push('VALID_ID_CO_BORROWER');
  if (requestedCategory === 'Salary Loan') categories.push('EMPLOYEE_ID', 'CORPORATE_PAYSLIP', 'CERTIFICATE_OF_EMPLOYMENT');
  if (requestedCategory === 'Business Loan') {
    categories.push('BUSINESS_CLEARANCE', 'DTI_SEC_REGISTRATION', 'BUSINESS_PERMIT', 'INCOME_TAX_RETURN', 'BANK_STATEMENT');
  }
  if (requestedCategory === 'Seafarer Loan') {
    categories.push('SEAMANS_BOOK', 'OVERSEAS_EMPLOYMENT_CERTIFICATE', 'POEA_CONTRACT', 'ALLOTMENT_SLIP', 'PASSPORT_ID');
  }
  return categories;
}
