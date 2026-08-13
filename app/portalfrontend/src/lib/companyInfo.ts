/**
 * Single source of truth for Easycash's public corporate identity.
 *
 * WHY THIS FILE EXISTS: as a lending company, Easycash is legally required to disclose its
 * registered name, SEC Registration No., and Certificate of Authority No. on its website and in
 * its advertising (RA 9474 - Lending Company Regulation Act; SEC MC 18-2019). Having these values
 * scattered across page components makes it possible for one page to fall out of date and become a
 * mis-disclosure. Every public page reads them from here instead.
 *
 * EVERY VALUE BELOW IS A LEGAL DISCLOSURE. Do not edit without written confirmation from
 * management/legal, and never substitute a placeholder or guess. If a value becomes unknown,
 * remove the disclosure rather than publishing a wrong one.
 *
 * Provenance: all values verified against the archived legacy Easycash website
 * (`legacy/website/legacy-site-content-2026-07-24.txt`) on 2026-07-28.
 * See `docs/PORTAL_WEBSITE_STRATEGY.md` §2.3.
 */

export const COMPANY = {
  /** Registered corporate name, exactly as filed with the SEC. */
  legalName: 'Easycash Lending Company, Inc.',
  shortName: 'Easycash',

  /** SEC Registration Number. Verified: legacy site, appears twice. */
  secRegistrationNo: 'CS201001882',
  /** Certificate of Authority to Operate as a Lending Company. Verified: legacy site, twice. */
  certificateOfAuthorityNo: '640',

  /** Registered principal office. */
  address: {
    line1: 'Unit 9 G/F The Midland Plaza',
    line2: 'M. Adriatico Street, Barangay 669',
    city: 'Ermita, Manila',
    country: 'Philippines',
  },

  contact: {
    landline: '(02) 5 310-3708',
    mobileSmart: '0947 595 6151',
    mobileGlobe: '0927 784 7091',
    /** Data Protection Officer, as required by RA 10173 (Data Privacy Act of 2012). */
    dpoEmail: 'dataprivacyofficer@easycash.ph',
    /** Confirmed by the business owner 2026-08-06 - see ContactPage.tsx's own doc comment on why
     * this was previously deliberately omitted (unconfirmed data). */
    businessHours: 'Monday to Friday, 8:00 AM to 5:00 PM',
  },
} as const;

/**
 * Official bank account for client loan payments (Bank Transfer channel).
 *
 * Provenance: supplied directly by the business owner via the "Easycash-Official-Bank-Account"
 * Google Doc, confirmed 2026-08-14. Do not edit without written confirmation from management -
 * a wrong digit here sends a client's payment to the wrong account, and this is also the
 * reference value clients are told to check against when verifying a payment request is
 * genuinely from Easycash (anti-scam use, mirrors OFFICIAL_CHANNELS below).
 */
export const OFFICIAL_BANK_ACCOUNT = {
  accountName: 'Easycash Lending Company, Inc.',
  bankName: 'BDO',
  branch: 'Times Plaza',
  accountNo: '003940-5805-45',
  proofOfPaymentEmail: 'collections@easycash.ph',
} as const;

/** Single-line registered address, for compact footers and meta tags. */
export const FORMATTED_ADDRESS = [
  COMPANY.address.line1,
  COMPANY.address.line2,
  COMPANY.address.city,
].join(', ');

/**
 * The regulatory disclosure line that must appear on every public page.
 * Format follows the convention used by SEC-registered lending companies in the Philippines.
 */
export const REGULATORY_DISCLOSURE = `SEC Reg. No. ${COMPANY.secRegistrationNo} · Certificate of Authority No. ${COMPANY.certificateOfAuthorityNo}`;

/**
 * Official contact channels, published so borrowers can verify that whoever is contacting them is
 * genuinely Easycash. This list is the reference point for the anti-scam page - if a channel is
 * not on this list, it is not Easycash.
 */
export const OFFICIAL_CHANNELS = [
  { label: 'Landline', value: COMPANY.contact.landline },
  { label: 'Smart', value: COMPANY.contact.mobileSmart },
  { label: 'Globe', value: COMPANY.contact.mobileGlobe },
  { label: 'Data Privacy Officer', value: COMPANY.contact.dpoEmail },
] as const;
