import type { PortalDocumentCategory } from '@/lib/portalApiTypes';

/**
 * The documents Easycash asks an applicant to provide, per loan product.
 *
 * SINGLE SOURCE OF TRUTH. This was extracted from `LoanApplicationFormPage.tsx` on 2026-07-28 so
 * that the public Requirements page and the actual application form can never disagree. Publishing
 * a requirements list that differs from what the form asks for wastes applicants' time and makes
 * Easycash look disorganised — exactly the failure mode the public page exists to prevent.
 *
 * These are the real categories the backend accepts (`PortalDocumentCategory`), mirroring the
 * staff-facing form's own DOCUMENT_SLOTS. Nothing here is invented; do not add an entry unless the
 * backend accepts it and the application form offers a slot for it.
 */

export type UploadableDocumentCategory = Exclude<PortalDocumentCategory, 'PROFILE_PICTURE'>;

export const DOCUMENT_LABELS: Record<UploadableDocumentCategory, string> = {
  // 2026-09-05 (business owner request): relabeled from "Valid ID"/"Employee ID" for clarity -
  // same upload category/backend value, display text only.
  VALID_ID_BORROWER: 'Government Valid ID',
  VALID_ID_CO_BORROWER: 'Valid ID (Co-Borrower)',
  PROOF_OF_BILLING: 'Proof of Billing',
  EMPLOYEE_ID: 'Company ID',
  BUSINESS_CLEARANCE: 'Business Clearance',
  CORPORATE_PAYSLIP: 'Payslip',
  SEAMANS_BOOK: "Seaman's Book",
  OVERSEAS_EMPLOYMENT_CERTIFICATE: 'Overseas Employment Certificate',
  OTHER_SUPPORTING_DOCUMENT: 'Other',
};

export interface DocumentSlot {
  category: UploadableDocumentCategory;
  /** Absent means "always required". */
  showWhen?: (ctx: { loanCategory: string; hasCoBorrower: boolean }) => boolean;
}

/** Mirrors the staff form's DOCUMENT_SLOTS showWhen logic exactly
 * (app/frontend LoanApplicationCreatePage.tsx) — only PROFILE_PICTURE is dropped (see the
 * backend's portalLoanApplicationSchemas.ts doc comment). */
export const DOCUMENT_SLOTS: DocumentSlot[] = [
  { category: 'VALID_ID_BORROWER' },
  { category: 'VALID_ID_CO_BORROWER', showWhen: (ctx) => ctx.hasCoBorrower },
  { category: 'PROOF_OF_BILLING' },
  { category: 'EMPLOYEE_ID', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'CORPORATE_PAYSLIP', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'BUSINESS_CLEARANCE', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'SEAMANS_BOOK', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'OVERSEAS_EMPLOYMENT_CERTIFICATE', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  // 2026-07-31 (user request): a per-product "Other" catch-all slot - always optional/
  // supplementary (see requiredDocumentCategories.ts on the backend), never counted as required.
  {
    category: 'OTHER_SUPPORTING_DOCUMENT',
    showWhen: (ctx) => ctx.loanCategory === 'Business Loan' || ctx.loanCategory === 'Salary Loan' || ctx.loanCategory === 'Seafarer Loan',
  },
];

/**
 * Documents needed for a given product, split into those every applicant provides and those only
 * this product asks for. Co-borrower documents are excluded — whether an applicant has one is not
 * known until they fill the form, so listing it as a requirement on a public page would mislead.
 */
export function getDocumentsForProduct(loanCategory: string): {
  always: string[];
  productSpecific: string[];
} {
  const always: string[] = [];
  const productSpecific: string[] = [];

  for (const slot of DOCUMENT_SLOTS) {
    if (slot.category === 'VALID_ID_CO_BORROWER' || slot.category === 'OTHER_SUPPORTING_DOCUMENT') continue;

    if (!slot.showWhen) {
      always.push(DOCUMENT_LABELS[slot.category]);
    } else if (slot.showWhen({ loanCategory, hasCoBorrower: false })) {
      productSpecific.push(DOCUMENT_LABELS[slot.category]);
    }
  }

  return { always, productSpecific };
}

/**
 * Informational-only additional requirements (business owner confirmed, 2026-09-05) - listed on
 * the public Requirements page but deliberately NOT added to `DOCUMENT_SLOTS`/`UploadableDocumentCategory`
 * above. Those two are also the real upload-slot config `LoanApplicationFormPage.tsx` renders, and
 * are backed by the `AttachmentDocumentCategory` Prisma enum on the backend - adding a genuinely
 * new upload category there needs a migration plus backend schema updates, not just a content
 * edit. Until that's done, these are things to have ready, not yet something a client can attach
 * through the Portal.
 */
export const ADDITIONAL_REQUIREMENTS_NOTES: Record<string, string[]> = {
  'Salary Loan': ['Latest Certificate of Employment (COE)'],
  'Seafarer Loan': [
    'Latest POEA Contract of Employment',
    'Latest Allotment Slip or Certificate of Salary and Allowance (CSA)',
    'Flight Details/Guarantee Letter (if available)',
    'Passport ID',
  ],
};

/**
 * Basic eligibility criteria.
 *
 * Source: the FAQ already published on the Easycash landing page and inherited from the legacy
 * site — i.e. these are Easycash's own published statements, not assumptions. Anything beyond this
 * (minimum income figures, maximum age, employment tenure) is NOT published anywhere confirmed and
 * must not be added here without written confirmation from management.
 */
export const ELIGIBILITY_CRITERIA = [
  'At least 18 years old',
  'Filipino citizen or resident of the Philippines',
  'Has a valid government-issued ID',
  'Has a stable source of income',
] as const;
