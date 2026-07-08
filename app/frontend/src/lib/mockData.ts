/**
 * ============================================================================
 * PREVIEW MODE — SAMPLE DATA ONLY. NOT CONNECTED TO app/backend.
 * ============================================================================
 * This entire module is hand-generated mock data for a CEO-facing UI preview
 * (Milestone 9.1, pre-CP13). It exists purely to demonstrate layout and
 * navigation flow before the real HTTP API (CP13) is wired up.
 *
 * Borrower names below are REAL customer names, sourced from
 * `legacy/reports/Fields in Google Spreadsheet.xlsx` ("MLR Master List",
 * column A). Every loan/balance/schedule figure attached to those names is
 * entirely FABRICATED for demo purposes — it does not represent any real
 * loan, balance, or transaction. Because real customer names are paired with
 * fabricated financial data, THIS BUILD MUST NOT BE DEPLOYED PUBLICLY OR
 * SHARED OUTSIDE AN INTERNAL PREVIEW AUDIENCE.
 *
 * Shapes here deliberately mirror the real backend domain types
 * (`LoanAccount`/`RepaymentInstallment`, `app/backend/src/modules/loan-account`
 * `/repayment`) so this mock layer is easy to swap for real `TanStack Query`
 * calls once CP13 (HTTP exposure) exists — same field names, same
 * `collectionsBalance`/`accountingBalance` split from ADR-007 §3.
 */

import { formatDate, formatPeso } from './utils';

export type LoanAccountStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ACTIVE_IN_ARREARS'
  /**
   * Active Matured — the loan has passed its full maturity date (end of the entire term) but is
   * still unpaid, carrying an outstanding balance; still active, not yet written off. The
   * highest-risk ACTIVE category. Deliberately distinct from `CLOSED` (which reached maturity AND
   * settled successfully) and from `ACTIVE_IN_ARREARS` (overdue on installments but still within
   * the term).
   */
  | 'MATURED'
  | 'CLOSED'
  | 'CLOSED_WRITTEN_OFF'
  | 'CLOSED_REJECTED';

export type RepaymentInstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';

/**
 * The product name a loan was originated under. Loosened to `string` (not a
 * closed union) because it must be able to hold either one of the 3
 * currently-ACTIVE product names OR one of the ~40 DISCONTINUED legacy
 * product names (`MOCK_LOAN_PRODUCTS` below) — a loan originated years ago
 * under a since-discontinued product is still a real, valid loan today.
 */
export type LoanProductType = string;

export const COMPANY_INFO = {
  name: 'Easycash Lending Company Inc.',
  branchName: 'Manila',
  address: 'Unit 9, G/F The Midland Plaza, M. Adriatico St., Barangay 669, Ermita, Manila',
} as const;

export interface MockLoanBalances {
  principalBalance: number;
  principalPaid: number;
  principalDue: number;
  interestBalance: number;
  interestPaid: number;
  interestDue: number;
  feesBalance: number;
  feesPaid: number;
  feesDue: number;
  penaltyBalance: number;
  penaltyPaid: number;
  penaltyDue: number;
}

export interface MockLoanAccount {
  id: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  loanOfficerName: string;
  /** FK into `MOCK_LOAN_PRODUCTS`. */
  productId: string;
  productType: LoanProductType;
  /** True when `productId` refers to a DISCONTINUED product — see `MOCK_LOAN_PRODUCTS`. */
  isDiscontinuedProduct: boolean;
  status: LoanAccountStatus;
  principalAmount: number;
  interestRate: number; // monthly %, DECLINING_BALANCE
  installmentCount: number;
  firstRepaymentDate: string;
  balances: MockLoanBalances;
  /** ADR-007 §3 (RESOLVED, Option B) — penalty-inclusive. */
  collectionsBalance: number;
  /** ADR-007 §3 (RESOLVED, Option B) — penalty-exclusive. */
  accountingBalance: number;
  approvedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  /** Code into `MOCK_PAYMENT_METHODS` — the mode of payment this loan is set up to collect through. */
  paymentMethod: string;
  /** Populated only when `paymentMethod === 'CASH'` and `status === 'ACTIVE_IN_ARREARS'` — door-to-door collection assignment. */
  collectionAgentName?: string;
  /** Populated only when `paymentMethod === 'AUTO_DEBIT'` — client-consent-based ATM debit authorization on file. */
  atmCardOnFile?: boolean;
  /** Optional — matches the legacy calculator's "Co-Borrower" field (`Loans_details` sheet). */
  coBorrowerName?: string;
  /**
   * Disbursement bank details — populated for `BANK_TRANSFER`/`AUTO_DEBIT` loans, matching
   * `Loans_details` columns `AD`–`AG` (`Bank Name`, `ATM Card Number`, `Bank Account Number`,
   * `Name on Card/Account`) in `OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm`.
   */
  disbursementBank?: {
    bankName: string;
    atmCardNumber: string;
    bankAccountNumber: string;
    nameOnCardOrAccount: string;
  };
  /** Set when this loan account was created from a specific approved Loan Application — see `findApprovedApplicationForClient()`. */
  sourceApplicationId?: string;
}

export interface MockRepaymentInstallment {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: string;
  due: { principal: number; interest: number; fees: number; penalty: number };
  paid: { principal: number; interest: number; fees: number; penalty: number };
  status: RepaymentInstallmentStatus;
}

export interface MockStatusEvent {
  status: LoanAccountStatus | 'DISBURSED';
  label: string;
  at: string;
  actor: string;
}

// Real borrower names — `legacy/reports/Fields in Google Spreadsheet.xlsx`,
// sheet "MLR Master List", column A ("CLIENT NAME"). 18 distinct rows.
const BORROWER_NAMES = [
  'Maria Dolores Parinas Rosales',
  'Rea A. Baroja',
  'Nicomedes D. Mendoza',
  'Ailene C. Co',
  'Nicolina N. Fajardo',
  'Juvy S. Nagas',
  'Gina C. Doblado',
  'Joanna B. Javier',
  'Allan A. Fernandez',
  'Danilo Felipe Gutierrez Jr.',
  'Antonio I. Tanala Jr.',
  'Jefferson C. Ante',
  'Rogelio A. Buenaflor',
  'Allan Rabaja Baguinon',
  'Arnel J. Chacon',
  'Marlon R. Ballesta',
  'Alex Cajote Reconalla',
  'Edilberto Depacaquibo Sentin',
] as const;

const LOAN_OFFICERS = ['J. Villanueva', 'M. Santos', 'R. Cruz', 'P. Ramos'];
// Easycash currently operates a single branch (see COMPANY_INFO above) —
// this array stays a single-element list (not a hardcoded scalar) so every
// screen's "branch filter" UI is exercised honestly with one real option,
// rather than special-cased away.
const BRANCHES: { id: string; name: string }[] = [{ id: 'branch-manila', name: COMPANY_INFO.branchName }];

/** Deterministic seeded RNG (mulberry32) — mock data must render identically on every load, not shuffle on each refresh. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260705);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const round2 = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Loan Products — ACTIVE vs. DISCONTINUED.
//
// Only 3 loan CATEGORIES are ACTIVE (available for new loan origination
// today): Salary Loan, Business Loan, Seafarer Loan. Salary Loan currently
// has 3 selectable sub-types (Corporate tie-up, Regular/standalone, Special
// repeat-client discount); Business Loan and Seafarer Loan each currently
// have a single "Regular" sub-type — confirmed business detail, not an
// assumption about future product expansion. Account codes follow the real
// naming convention: `{CATEGORY}-{SubType}_{4-digit sequence}`, e.g.
// `SL-Corp_0001`, `SL-Reg_0002`, `BL-Reg_0001`, `SML-Reg_0001`. Every other
// product name below is a real, historical product code from `legacy/mongodb/.../loan_products
// .bson` (44 documents in that export; 2 excluded here — a QA "Test Product"
// entry and one corrupted/malformed record with no real name, neither of
// which represent an actual retail product). These DISCONTINUED products are
// deliberately NOT hidden: several still have real client loans open against
// them (see `LOAN_GENERATION_CATALOG` below), matching the legacy data's own
// evidence that closing a product doesn't retroactively close the loans
// already issued under it.
// ---------------------------------------------------------------------------

export interface MockFeeRule {
  name: string;
  computation: 'FLAT' | 'PERCENT_OF_PRINCIPAL';
  value: number;
}

/**
 * A loan document template attached to a product — the merge-field body used to generate that
 * product's official loan documents (Promissory Note, Disclosure Statement, etc.) once a loan
 * account under it is activated. Evidence: `legacy/reports/201 Loan Docs Generator/*.docx`, the
 * company's real MS Word mail-merge templates (`{{BorrowerName}}`-style fields). Editable per
 * product in the Loan Products page — preview-only, held in component state, never persisted.
 */
export interface MockDocumentTemplate {
  /** Short code matching the legacy template file naming (PN, DS, LA, DOA, DPCF, SPA). */
  code: string;
  name: string;
  /** Legacy source file this was adapted from, shown for traceability only. */
  sourceFileName: string;
  /** Mail-merge template body. Editable in the Loan Products UI; `{{Field}}` tokens are filled in per loan account when generated. */
  content: string;
}

// Two document sets found in `legacy/reports/201 Loan Docs Generator/`: a standard set (DOA/LA)
// and a "-SL" suffixed set (DOA-SL/LA-SL) used only for seafarer allotment loans — confirmed by
// the SPA template's own text ("restructure the existing allotment loan"), which is seafarer-
// specific and has no standard-set equivalent.
const STANDARD_DOCUMENT_TEMPLATES: MockDocumentTemplate[] = [
  {
    code: 'PN',
    name: 'Promissory Note',
    sourceFileName: '201 Loan Docs PN Template.docx',
    content:
      'PROMISSORY NOTE\n\nPromissory Note Number: {{LoanAccount}}\nMaturity Date: {{MaturityDate}}\nLoan Amount: {{Obligation}}\n\n' +
      'For value received, I/We, {{BorrowerName}}, residing at {{BorrowerAddress}}{{CoBorrowerNameSection}}, jointly and severally, ' +
      'promise to pay to the order of Easycash Lending Company Inc. the sum of {{ObligationWords}}, Philippine Currency, with interest ' +
      'at the rate of {{InterestRateWords}} per month, in {{InstallmentCount}} installments beginning {{FirstDueDate}}.',
  },
  {
    code: 'DS',
    name: 'Disclosure Statement',
    sourceFileName: '201 Loan Docs DS Template.docx',
    content:
      'DISCLOSURE STATEMENT ON LOAN/CREDIT TRANSACTION\n(As Required under R.A. 3765, Truth In Lending Act)\n\n' +
      "Borrower's Name: {{BorrowerName}}\nLoan Account ID: {{LoanAccount}}\nAddress: {{BorrowerAddress}}\n\n" +
      '1. LOAN AMOUNT: {{LoanAmount}}\n2. OTHER BANK CHARGES/DEDUCTIONS COLLECTED: {{OtherCharges}}\n' +
      '3. NET PROCEEDS: {{NetProceeds}}\n4. FINANCE CHARGES: {{FinanceCharges}}\n5. EFFECTIVE INTEREST RATE: {{EffectiveRate}}',
  },
  {
    code: 'LA',
    name: 'Loan Agreement',
    sourceFileName: '201 Loan Docs LA Template.docx',
    content:
      'LOAN AGREEMENT\n\nEasycash Lending Company, Inc. ("Easycash"), with principal office at Unit 9, Ground Floor, The Midland Plaza, ' +
      'M. Adriatico, Barangay 669, Ermita, Manila, and the Borrower, {{BorrowerName}}, and Co-Borrower, {{CoBorName}}, with address at ' +
      '{{BorrowerAddress}} and {{CoBorAddress}} respectively, hereby agree to enter into this Loan Agreement this {{DisbursementDate}} ' +
      'for the principal sum of {{LoanAmount}}, payable in {{InstallmentCount}} monthly installments.',
  },
  {
    code: 'DOA',
    name: 'Deed of Assignment',
    sourceFileName: '201 Loan Docs DOA Template.docx',
    content:
      'DEED OF ASSIGNMENT\nWith Authority to Deduct and Irrevocable Special Power of Attorney\n\nKNOW ALL MEN BY THESE PRESENTS:\n\n' +
      'That I/We {{BorrowerName}} / {{CoBorName}}, of legal age, Filipino citizen/s, resident/s of {{BorrowerAddress}}, hereinafter ' +
      'referred to as the "ASSIGNOR"; and EASYCASH LENDING COMPANY, INC., a corporation duly registered and organized under the laws ' +
      'of the Philippines, hereby agree that the Assignor irrevocably assigns {{ObligationWords}} out of any and all monies due.',
  },
  {
    code: 'DPCF',
    name: 'Data Privacy and Consent Form',
    sourceFileName: '201 Loan Docs DPCF Template.docx',
    content:
      'DATA PRIVACY AND CONSENT FORM\n\n' +
      'I/We, {{BorrowerName}}, know and understand that Easycash Lending Company, Inc. ("Easycash") is a Filipino corporation ' +
      'organized and existing under the laws of the Philippines and registered with the Securities and Exchange Commission, with the ' +
      'primary objective of providing loans, credit, or other financial accommodation to deserving individuals and businesses. ' +
      'I/We consent to the collection, processing, and storage of my/our personal data for {{LoanAccount}} in accordance with the ' +
      'Data Privacy Act of 2012.',
  },
];

const SEAFARER_DOCUMENT_TEMPLATES: MockDocumentTemplate[] = [
  STANDARD_DOCUMENT_TEMPLATES[0]!, // PN — same across categories
  STANDARD_DOCUMENT_TEMPLATES[1]!, // DS — same across categories
  {
    code: 'LA-SL',
    name: 'Loan Agreement (Seafarer)',
    sourceFileName: '201 Loan Docs LA-SL Template.docx',
    content:
      'LOAN AGREEMENT (SEAFARER ALLOTMENT)\n\nEasycash Lending Company, Inc. ("Easycash"), with principal office at Unit 9, Ground ' +
      'Floor, The Midland Plaza, M. Adriatico, Barangay 669, Ermita, Manila, and the Borrower, {{BorrowerName}}, and Co-Borrower, ' +
      '{{CoBorName}}, with address at {{BorrowerAddress}} and {{CoBorAddress}} respectively, hereby agree to enter into this Loan ' +
      'Agreement this {{DisbursementDate}} for the principal sum of {{LoanAmount}}, secured against the Borrower\'s seafarer allotment.',
  },
  {
    code: 'DOA-SL',
    name: 'Deed of Assignment (Seafarer)',
    sourceFileName: '201 Loan Docs DOA-SL Template.docx',
    content:
      'DEED OF ASSIGNMENT (SEAFARER ALLOTMENT)\nWith Authority to Deduct and Irrevocable Special Power of Attorney\n\n' +
      'KNOW ALL MEN BY THESE PRESENTS: That I/We {{BorrowerName}}, {{CoBorName}}, of legal age, Filipino citizen/s, resident/s of ' +
      '{{BorrowerAddress}}, hereinafter referred to as the "ASSIGNOR"; and EASYCASH LENDING COMPANY, INC. hereby agree that the ' +
      "Assignor irrevocably assigns {{ObligationWords}} out of the Assignor's monthly seafarer allotment.",
  },
  STANDARD_DOCUMENT_TEMPLATES[4]!, // DPCF — same across categories
  {
    code: 'SPA',
    name: 'Special Power of Attorney',
    sourceFileName: '201 Loan Docs SPA Template.docx',
    content:
      'SPECIAL POWER OF ATTORNEY\n\n' +
      'I, {{BorrowerName}}, of legal age, Filipino, and a resident of {{BorrowerAddress}}, hereby NAME, APPOINT, and CONSTITUTE ' +
      '{{CoBorName}}, with address at {{CoBorAddress}}, to be my true and lawful Attorney-in-Fact, to do and perform the following ' +
      'acts in my name, place, and stead: To restructure the existing allotment loan with Easycash Lending Company Inc., only if ' +
      'the Principal is unable to do so personally due to being at sea.',
  },
];

export interface MockLoanProduct {
  id: string;
  productCode: string;
  productName: string;
  /** Category this sub-type rolls up under in the Loan Products grouped view (e.g. "Salary Loan"). Active products only. */
  category?: string;
  versionNumber: number;
  isActive: boolean;
  interestCalculationMethod: 'FLAT' | 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED';
  daysInYearConvention: string;
  repaymentPeriodUnit: 'MONTHS';
  loanAmountMin: number;
  loanAmountMax: number;
  installmentCountMin: number;
  installmentCountMax: number;
  gracePeriodDefaultDays: number;
  roundingMethod: 'NO_ROUNDING' | 'ROUND_REMAINDER_INTO_LAST_REPAYMENT';
  defaultInterestRate: number;
  minInterestRate: number;
  maxInterestRate: number;
  penaltyRule: { ratePercent: number; gracePeriodDays: number };
  feeRules: MockFeeRule[];
  /** Set only for discontinued/legacy products — shown as a note in the UI. */
  legacyNote?: string;
  /** Loan document templates generated when a loan account under this product is activated — editable per product in the Loan Products page. */
  documentTemplates: MockDocumentTemplate[];
}

/** Clones a template set so editing one product's templates never mutates another's. */
function cloneTemplates(templates: MockDocumentTemplate[]): MockDocumentTemplate[] {
  return templates.map((t) => ({ ...t }));
}

const ACTIVE_PRODUCTS: MockLoanProduct[] = [
  {
    id: 'product-sl-corp',
    productCode: 'SL-CORP',
    productName: 'Salary Loan — Corporate Tie-up',
    category: 'Salary Loan',
    versionNumber: 3,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE_DISCOUNTED',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 10000,
    loanAmountMax: 300000,
    installmentCountMin: 3,
    installmentCountMax: 24,
    gracePeriodDefaultDays: 5,
    roundingMethod: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
    defaultInterestRate: 4.5,
    minInterestRate: 2.5,
    maxInterestRate: 5.75,
    penaltyRule: { ratePercent: 5, gracePeriodDays: 5 },
    feeRules: [
      { name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: 2 },
      { name: 'Documentary Stamp Tax', computation: 'FLAT', value: 150 },
    ],
    legacyNote: 'For clients employed by an Easycash tied-up agency/employer partner.',
    documentTemplates: cloneTemplates(STANDARD_DOCUMENT_TEMPLATES),
  },
  {
    id: 'product-sl-regular',
    productCode: 'SL-REGULAR',
    productName: 'Salary Loan — Regular',
    category: 'Salary Loan',
    versionNumber: 3,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE_DISCOUNTED',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 10000,
    loanAmountMax: 300000,
    installmentCountMin: 3,
    installmentCountMax: 24,
    gracePeriodDefaultDays: 5,
    roundingMethod: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
    defaultInterestRate: 4.95,
    minInterestRate: 2.75,
    maxInterestRate: 6.5,
    penaltyRule: { ratePercent: 5, gracePeriodDays: 5 },
    feeRules: [
      { name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: 2 },
      { name: 'Documentary Stamp Tax', computation: 'FLAT', value: 150 },
    ],
    legacyNote: 'For standalone clients with no tied-up agency/employer partnership.',
    documentTemplates: cloneTemplates(STANDARD_DOCUMENT_TEMPLATES),
  },
  {
    id: 'product-sl-spec',
    productCode: 'SL-SPEC',
    productName: 'Salary Loan — Special (Repeat Client)',
    category: 'Salary Loan',
    versionNumber: 3,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE_DISCOUNTED',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 10000,
    loanAmountMax: 300000,
    installmentCountMin: 3,
    installmentCountMax: 24,
    gracePeriodDefaultDays: 5,
    roundingMethod: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
    defaultInterestRate: 4.25,
    minInterestRate: 2.25,
    maxInterestRate: 5.25,
    penaltyRule: { ratePercent: 5, gracePeriodDays: 5 },
    feeRules: [
      { name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: 2 },
      { name: 'Documentary Stamp Tax', computation: 'FLAT', value: 150 },
    ],
    legacyNote: 'Discounted rate for repeat clients in good standing.',
    documentTemplates: cloneTemplates(STANDARD_DOCUMENT_TEMPLATES),
  },
  {
    id: 'product-bl-regular',
    productCode: 'BL-REGULAR',
    productName: 'Business Loan — Regular',
    category: 'Business Loan',
    versionNumber: 2,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 50000,
    loanAmountMax: 1000000,
    installmentCountMin: 6,
    installmentCountMax: 36,
    gracePeriodDefaultDays: 10,
    roundingMethod: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
    defaultInterestRate: 3.8,
    minInterestRate: 2,
    maxInterestRate: 4.55,
    penaltyRule: { ratePercent: 4, gracePeriodDays: 10 },
    feeRules: [
      { name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: 2.5 },
      { name: 'Credit Investigation Fee', computation: 'FLAT', value: 1000 },
    ],
    documentTemplates: cloneTemplates(STANDARD_DOCUMENT_TEMPLATES),
  },
  {
    id: 'product-sml-regular',
    productCode: 'SML-REGULAR',
    productName: 'Seafarer Loan — Regular',
    category: 'Seafarer Loan',
    versionNumber: 1,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 20000,
    loanAmountMax: 500000,
    installmentCountMin: 6,
    installmentCountMax: 12,
    gracePeriodDefaultDays: 15,
    roundingMethod: 'NO_ROUNDING',
    defaultInterestRate: 2.75,
    minInterestRate: 2,
    maxInterestRate: 3.47,
    penaltyRule: { ratePercent: 3, gracePeriodDays: 15 },
    feeRules: [{ name: 'Processing Fee', computation: 'FLAT', value: 2500 }],
    documentTemplates: cloneTemplates(SEAFARER_DOCUMENT_TEMPLATES),
  },
];

// Real product names — `legacy/mongodb/07012026_103239/db-easycash/
// loan_products.bson`, `name` field (44 documents total; excludes a QA
// "Test Product" record and one malformed record with no real product name).
// Exact-name collisions with the 3 active codes above ("SL-Regular",
// "BL-Regular") are also excluded here — their "(OLD)" suffixed siblings
// already represent the discontinued/legacy flavor without looking like a
// duplicate of a current active product in this UI.
const DISCONTINUED_PRODUCT_NAMES = [
  'SL-Lazada -New',
  'SML-Quick Cash',
  'SL-Online',
  'SL-Corporate',
  'SL-Snap-A',
  'SL-Regular(OLD)',
  'SML-PDC',
  'SL-Snap-B',
  'SML-Others',
  'PFL-Gadgets, Appliances',
  'SML-Corporate',
  'SML-Max',
  'SL-Corporate(OLD)',
  'REL-Regular',
  'SML-Quick Cash(OLD)',
  'SML-Regular',
  'SML-Special',
  'PFL-Motorcycle',
  'SL-Lazada',
  'PL-Special',
  'CL-Regular',
  'PFL-Gadgets, Appliances ( INACTIVE )',
  'BL-Special',
  'SML-Regular(OLD)',
  'CL-Special',
  'SL-Lazada-Promo',
  'OFW',
  'SML-SEACON',
  'SML-Kaborrow',
  'SP-Easy Loan',
  'SML-Co-Borrower Allotment',
  'OTH-Compromise',
  'SP-Flash Loan',
  'SML-Lite',
  'SML-Self Allotment',
  'BL-Regular (OLD)',
  'SL-Online(OLD)',
  'SL-Online_New',
  'PL-SPEC',
  'SML-Deluxe',
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function buildDiscontinuedProduct(name: string): MockLoanProduct {
  const defaultRate = round2(2 + rng() * 6);
  return {
    id: `product-legacy-${slugify(name)}`,
    productCode: name,
    productName: name,
    versionNumber: 1,
    isActive: false,
    interestCalculationMethod: pick(['DECLINING_BALANCE', 'DECLINING_BALANCE_DISCOUNTED', 'FLAT']),
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: round2(3000 + rng() * 7000),
    loanAmountMax: round2(30000 + rng() * 200000),
    installmentCountMin: pick([1, 2, 3]),
    installmentCountMax: pick([6, 12, 18, 24]),
    gracePeriodDefaultDays: pick([0, 3, 5, 10]),
    roundingMethod: pick(['NO_ROUNDING', 'ROUND_REMAINDER_INTO_LAST_REPAYMENT']),
    defaultInterestRate: defaultRate,
    minInterestRate: round2(Math.max(1, defaultRate - 1.5)),
    maxInterestRate: round2(defaultRate + 2),
    penaltyRule: { ratePercent: pick([3, 4, 5]), gracePeriodDays: pick([0, 3, 5, 10]) },
    feeRules: [],
    legacyNote:
      'Historical product from the legacy system — retained because existing loan accounts still reference it; not available for new originations.',
    // "SML" (Seafarer Loan) legacy codes get the seafarer document set (matches the -SL legacy
    // templates); everything else gets the standard set. Existing loans on these discontinued
    // products still need a document set for their own Attachments tab.
    documentTemplates: cloneTemplates(name.startsWith('SML') ? SEAFARER_DOCUMENT_TEMPLATES : STANDARD_DOCUMENT_TEMPLATES),
  };
}

const DISCONTINUED_PRODUCTS: MockLoanProduct[] = DISCONTINUED_PRODUCT_NAMES.map(buildDiscontinuedProduct);

/** ACTIVE products first, then every DISCONTINUED legacy product — nothing hidden. */
export const MOCK_LOAN_PRODUCTS: MockLoanProduct[] = [...ACTIVE_PRODUCTS, ...DISCONTINUED_PRODUCTS];

export function getMockLoanProduct(id: string): MockLoanProduct | undefined {
  return MOCK_LOAN_PRODUCTS.find((p) => p.id === id);
}

/**
 * What `generateLoan()` below actually assigns to loans. Deliberately not
 * "one entry per `MOCK_LOAN_PRODUCTS` row" — most generated loans use one of
 * the 5 active sub-types (the realistic common case), but two discontinued
 * products (`SML-Regular`, `SML-Max`) are included here specifically so
 * `STATUS_PLAN`'s forced overrides (below) can demonstrate a real
 * ACTIVE/ACTIVE_IN_ARREARS client loan still sitting on a discontinued
 * product — the exact scenario this checkpoint asked to make visible.
 *
 * `codePrefix` here is the real account-code prefix pattern (confirmed):
 * `{CATEGORY}-{SubType}`, e.g. `SL-Corp`, combined in `nextLoanCode()` below
 * with a 4-digit sequence number that increments per prefix.
 */
const LOAN_GENERATION_CATALOG: { product: MockLoanProduct; codePrefix: string }[] = [
  { product: ACTIVE_PRODUCTS[0]!, codePrefix: 'SL-Corp' },
  { product: ACTIVE_PRODUCTS[1]!, codePrefix: 'SL-Reg' },
  { product: ACTIVE_PRODUCTS[2]!, codePrefix: 'SL-Spec' },
  { product: ACTIVE_PRODUCTS[3]!, codePrefix: 'BL-Reg' },
  { product: ACTIVE_PRODUCTS[4]!, codePrefix: 'SML-Reg' },
];

function findDiscontinuedCatalogEntry(productCode: string): { product: MockLoanProduct; codePrefix: string } {
  const product = DISCONTINUED_PRODUCTS.find((p) => p.productCode === productCode);
  if (!product) throw new Error(`Unknown discontinued product code for mock data: ${productCode}`);
  return { product, codePrefix: productCode.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() };
}

/** Sequential per-prefix counter for account codes — mirrors the real convention (continues from the previous number for that prefix, not reset per loan). */
const loanCodeCounters: Record<string, number> = {};
function nextLoanCode(codePrefix: string): string {
  const next = (loanCodeCounters[codePrefix] ?? 0) + 1;
  loanCodeCounters[codePrefix] = next;
  return `${codePrefix}_${next.toString().padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Mode of Payment / Collection Methods — ACTIVE vs. DISCONTINUED.
//
// ACTIVE (offered today, selectable on the Payment Recording screen): GCash,
// Cash, Bank Transfer, Post-Dated Check (PDC), Auto Debit.
//
// DISCONTINUED (no longer offered, but must remain visible on historical
// transactions and as a Transaction Report filter): DragonPay, plus 4
// additional real legacy payment channels found in `legacy/mongodb/
// .../loan_transactions.bson`'s free-text `comment` field (this schema has
// no dedicated payment-method column — these were identified by searching
// that field for real channel names, not invented): "ECPAY" (ECPay),
// "Deposited thru Bayad Center...", "LBC payment"/"...thru LBC", "Paid thru
// western union", and "Paid thru Palawan Pawnshop...".
// ---------------------------------------------------------------------------

export interface MockPaymentMethod {
  code: string;
  label: string;
  isActive: boolean;
  legacyNote?: string;
}

export const ACTIVE_PAYMENT_METHODS: MockPaymentMethod[] = [
  { code: 'GCASH', label: 'GCash', isActive: true },
  { code: 'CASH', label: 'Cash', isActive: true },
  { code: 'BANK_TRANSFER', label: 'Bank Transfer', isActive: true },
  { code: 'PDC', label: 'Post-Dated Check (PDC)', isActive: true },
  { code: 'AUTO_DEBIT', label: 'Auto Debit', isActive: true },
];

const LEGACY_NOTE =
  'Historical payment channel from the legacy system — retained because past transactions used it; not offered for new payments.';

export const DISCONTINUED_PAYMENT_METHODS: MockPaymentMethod[] = [
  { code: 'DRAGONPAY', label: 'DragonPay', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'ECPAY', label: 'ECPay', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'BAYAD_CENTER', label: 'Bayad Center', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'LBC', label: 'LBC', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'WESTERN_UNION', label: 'Western Union', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'PALAWAN_PAWNSHOP', label: 'Palawan Pawnshop', isActive: false, legacyNote: LEGACY_NOTE },
];

export const MOCK_PAYMENT_METHODS: MockPaymentMethod[] = [...ACTIVE_PAYMENT_METHODS, ...DISCONTINUED_PAYMENT_METHODS];

export function getPaymentMethodLabel(code: string): string {
  return MOCK_PAYMENT_METHODS.find((m) => m.code === code)?.label ?? code;
}

export function isDiscontinuedPaymentMethod(code: string): boolean {
  return MOCK_PAYMENT_METHODS.find((m) => m.code === code)?.isActive === false;
}

const COLLECTION_AGENTS = ['Rico D. Manalastas', 'Fernando T. Aquino', 'Ben-Hur Salamat'];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export interface InterestRateChartEntry {
  term: number;
  addOnRate: number;
  contractualRate: number;
}

/**
 * The official calculator's Add-On → Contractual rate lookup table — evidence:
 * `legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx`, sheet `Interest Rate Chart`
 * (`A2:C136`), read by the `Fill up form`/`manual input for LOAN AMOUNT` sheet's `Contractual
 * Interest Rate` cell via
 * `INDEX(C2:C136, MATCH(1, (A2:A136=Term)*(B2:B136=AddOnRate), 0))` — an exact 2D lookup, not a
 * formula-derived conversion. This resolves `CALCULATION_ENGINE_SPEC.md` §3's "reverse direction
 * (Add-On → Contractual)... uses a precomputed lookup table" note with the real table contents.
 *
 * Cross-validated against a second, independent copy of the same table:
 * `legacy/reports/OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm`, sheet `Rate_details`
 * (139 rows). The two copies agree on every tier except two corrections this second copy
 * resolved:
 * - The `Add-On 10.0%` tier (terms 1–3) is real, not stray test data as first assumed from the
 *   Encode.xlsx copy alone — that copy stored it as raw fractions (`0.1`/`0.1307`/`0.1436`)
 *   instead of whole percent like every other row, a unit inconsistency `Rate_details` doesn't
 *   share (`10`/`13.07`/`14.36`). Corrected below to the `Rate_details` values.
 * - `Rate_details` additionally has an `Add-On 5.0%` tier (terms 1–4: `5`/`6.6`/`7.33`/`7.72`,
 *   not present in the Encode.xlsx copy) — added below.
 * Every other value matched exactly between both independent sources, which is why they're
 * trusted as correct rather than further second-guessed.
 */
export const INTEREST_RATE_CHART: InterestRateChartEntry[] = [
  { term: 1, addOnRate: 1.5, contractualRate: 1.5 },
  { term: 2, addOnRate: 1.5, contractualRate: 2.0 },
  { term: 3, addOnRate: 1.5, contractualRate: 2.24 },
  { term: 4, addOnRate: 1.5, contractualRate: 2.37 },
  { term: 5, addOnRate: 1.5, contractualRate: 2.46 },
  { term: 6, addOnRate: 1.5, contractualRate: 2.52 },
  { term: 7, addOnRate: 1.5, contractualRate: 2.56 },
  { term: 8, addOnRate: 1.5, contractualRate: 2.59 },
  { term: 9, addOnRate: 1.5, contractualRate: 2.61 },
  { term: 10, addOnRate: 1.5, contractualRate: 2.63 },
  { term: 11, addOnRate: 1.5, contractualRate: 2.63 },
  { term: 12, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 13, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 14, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 15, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 16, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 17, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 18, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 19, addOnRate: 1.5, contractualRate: 2.65 },
  { term: 20, addOnRate: 1.5, contractualRate: 2.64 },
  { term: 21, addOnRate: 1.5, contractualRate: 2.64 },
  { term: 22, addOnRate: 1.5, contractualRate: 2.63 },
  { term: 23, addOnRate: 1.5, contractualRate: 2.63 },
  { term: 24, addOnRate: 1.5, contractualRate: 2.62 },
  { term: 1, addOnRate: 1.75, contractualRate: 4.16 },
  { term: 2, addOnRate: 1.75, contractualRate: 2.39 },
  { term: 3, addOnRate: 1.75, contractualRate: 2.42 },
  { term: 4, addOnRate: 1.75, contractualRate: 2.77 },
  { term: 5, addOnRate: 1.75, contractualRate: 2.87 },
  { term: 6, addOnRate: 1.75, contractualRate: 2.93 },
  { term: 7, addOnRate: 1.75, contractualRate: 2.98 },
  { term: 8, addOnRate: 1.75, contractualRate: 3.0 },
  { term: 9, addOnRate: 1.75, contractualRate: 3.03 },
  { term: 10, addOnRate: 1.75, contractualRate: 3.05 },
  { term: 11, addOnRate: 1.75, contractualRate: 3.06 },
  { term: 12, addOnRate: 1.75, contractualRate: 3.07 },
  { term: 13, addOnRate: 1.75, contractualRate: 3.07 },
  { term: 14, addOnRate: 1.75, contractualRate: 3.07 },
  { term: 15, addOnRate: 1.75, contractualRate: 3.06 },
  { term: 16, addOnRate: 1.75, contractualRate: 3.07 },
  { term: 17, addOnRate: 1.75, contractualRate: 3.06 },
  { term: 18, addOnRate: 1.75, contractualRate: 3.05 },
  { term: 19, addOnRate: 1.75, contractualRate: 3.05 },
  { term: 20, addOnRate: 1.75, contractualRate: 3.05 },
  { term: 21, addOnRate: 1.75, contractualRate: 3.04 },
  { term: 22, addOnRate: 1.75, contractualRate: 3.05 },
  { term: 23, addOnRate: 1.75, contractualRate: 3.03 },
  { term: 24, addOnRate: 1.75, contractualRate: 3.02 },
  { term: 1, addOnRate: 2.0, contractualRate: 2.0 },
  { term: 2, addOnRate: 2.0, contractualRate: 2.65 },
  { term: 3, addOnRate: 2.0, contractualRate: 2.97 },
  { term: 4, addOnRate: 2.0, contractualRate: 3.15 },
  { term: 5, addOnRate: 2.0, contractualRate: 3.27 },
  { term: 6, addOnRate: 2.0, contractualRate: 3.33 },
  { term: 7, addOnRate: 2.0, contractualRate: 3.38 },
  { term: 8, addOnRate: 2.0, contractualRate: 3.42 },
  { term: 9, addOnRate: 2.0, contractualRate: 3.44 },
  { term: 10, addOnRate: 2.0, contractualRate: 3.46 },
  { term: 11, addOnRate: 2.0, contractualRate: 3.47 },
  { term: 12, addOnRate: 2.0, contractualRate: 3.47 },
  { term: 1, addOnRate: 2.25, contractualRate: 2.25 },
  { term: 2, addOnRate: 2.25, contractualRate: 2.99 },
  { term: 3, addOnRate: 2.25, contractualRate: 3.34 },
  { term: 4, addOnRate: 2.25, contractualRate: 3.54 },
  { term: 5, addOnRate: 2.25, contractualRate: 3.67 },
  { term: 6, addOnRate: 2.25, contractualRate: 3.75 },
  { term: 7, addOnRate: 2.25, contractualRate: 3.8 },
  { term: 8, addOnRate: 2.25, contractualRate: 3.84 },
  { term: 9, addOnRate: 2.25, contractualRate: 3.86 },
  { term: 10, addOnRate: 2.25, contractualRate: 3.87 },
  { term: 11, addOnRate: 2.25, contractualRate: 3.88 },
  { term: 12, addOnRate: 2.25, contractualRate: 3.89 },
  { term: 1, addOnRate: 2.5, contractualRate: 2.5 },
  { term: 2, addOnRate: 2.5, contractualRate: 3.32 },
  { term: 3, addOnRate: 2.5, contractualRate: 3.7 },
  { term: 4, addOnRate: 2.5, contractualRate: 3.92 },
  { term: 5, addOnRate: 2.5, contractualRate: 4.06 },
  { term: 6, addOnRate: 2.5, contractualRate: 4.15 },
  { term: 7, addOnRate: 2.5, contractualRate: 4.2 },
  { term: 8, addOnRate: 2.5, contractualRate: 4.24 },
  { term: 9, addOnRate: 2.5, contractualRate: 4.27 },
  { term: 10, addOnRate: 2.5, contractualRate: 4.27 },
  { term: 11, addOnRate: 2.5, contractualRate: 4.28 },
  { term: 12, addOnRate: 2.5, contractualRate: 4.28 },
  { term: 13, addOnRate: 2.5, contractualRate: 4.29 },
  { term: 14, addOnRate: 2.5, contractualRate: 4.28 },
  { term: 15, addOnRate: 2.5, contractualRate: 4.28 },
  { term: 16, addOnRate: 2.5, contractualRate: 4.27 },
  { term: 17, addOnRate: 2.5, contractualRate: 4.26 },
  { term: 18, addOnRate: 2.5, contractualRate: 4.24 },
  { term: 19, addOnRate: 2.5, contractualRate: 4.23 },
  { term: 20, addOnRate: 2.5, contractualRate: 4.22 },
  { term: 21, addOnRate: 2.5, contractualRate: 4.21 },
  { term: 22, addOnRate: 2.5, contractualRate: 4.19 },
  { term: 23, addOnRate: 2.5, contractualRate: 4.18 },
  { term: 24, addOnRate: 2.5, contractualRate: 4.16 },
  { term: 1, addOnRate: 2.75, contractualRate: 2.75 },
  { term: 2, addOnRate: 2.75, contractualRate: 3.65 },
  { term: 3, addOnRate: 2.75, contractualRate: 4.07 },
  { term: 4, addOnRate: 2.75, contractualRate: 4.31 },
  { term: 5, addOnRate: 2.75, contractualRate: 4.46 },
  { term: 6, addOnRate: 2.75, contractualRate: 4.55 },
  { term: 7, addOnRate: 2.75, contractualRate: 4.6 },
  { term: 8, addOnRate: 2.75, contractualRate: 4.65 },
  { term: 9, addOnRate: 2.75, contractualRate: 4.67 },
  { term: 10, addOnRate: 2.75, contractualRate: 4.68 },
  { term: 11, addOnRate: 2.75, contractualRate: 4.69 },
  { term: 12, addOnRate: 2.75, contractualRate: 4.69 },
  { term: 1, addOnRate: 3.0, contractualRate: 3.0 },
  { term: 2, addOnRate: 3.0, contractualRate: 3.98 },
  { term: 3, addOnRate: 3.0, contractualRate: 4.43 },
  { term: 4, addOnRate: 3.0, contractualRate: 4.7 },
  { term: 5, addOnRate: 3.0, contractualRate: 4.85 },
  { term: 6, addOnRate: 3.0, contractualRate: 4.95 },
  { term: 7, addOnRate: 3.0, contractualRate: 5.01 },
  { term: 8, addOnRate: 3.0, contractualRate: 5.05 },
  { term: 9, addOnRate: 3.0, contractualRate: 5.07 },
  { term: 10, addOnRate: 3.0, contractualRate: 5.08 },
  { term: 11, addOnRate: 3.0, contractualRate: 5.08 },
  { term: 12, addOnRate: 3.0, contractualRate: 5.08 },
  { term: 1, addOnRate: 3.5, contractualRate: 3.5 },
  { term: 2, addOnRate: 3.5, contractualRate: 4.63 },
  { term: 3, addOnRate: 3.5, contractualRate: 5.17 },
  { term: 4, addOnRate: 3.5, contractualRate: 5.45 },
  { term: 5, addOnRate: 3.5, contractualRate: 5.63 },
  { term: 6, addOnRate: 3.5, contractualRate: 5.73 },
  { term: 7, addOnRate: 3.5, contractualRate: 5.8 },
  { term: 8, addOnRate: 3.5, contractualRate: 5.83 },
  { term: 9, addOnRate: 3.5, contractualRate: 5.86 },
  { term: 10, addOnRate: 3.5, contractualRate: 5.86 },
  { term: 11, addOnRate: 3.5, contractualRate: 5.86 },
  { term: 12, addOnRate: 3.5, contractualRate: 5.86 },
  // Add-On 5.0% and 10.0% tiers — from `Rate_details` only, see the doc comment above.
  { term: 1, addOnRate: 5.0, contractualRate: 5.0 },
  { term: 2, addOnRate: 5.0, contractualRate: 6.6 },
  { term: 3, addOnRate: 5.0, contractualRate: 7.33 },
  { term: 4, addOnRate: 5.0, contractualRate: 7.72 },
  { term: 1, addOnRate: 10.0, contractualRate: 10.0 },
  { term: 2, addOnRate: 10.0, contractualRate: 13.07 },
  { term: 3, addOnRate: 10.0, contractualRate: 14.36 },
];

/** Every distinct Add-On Rate tier on file, for the Create Loan Account form's rate dropdown. */
export const ADD_ON_RATE_TIERS: number[] = [...new Set(INTEREST_RATE_CHART.map((e) => e.addOnRate))].sort((a, b) => a - b);

/** Exact lookup only — no interpolation, per this project's no-invented-formula rule. `null` when the term/add-on combination isn't on file. */
export function lookupContractualRate(termMonths: number, addOnRatePercent: number): number | null {
  const entry = INTEREST_RATE_CHART.find((e) => e.term === termMonths && Math.abs(e.addOnRate - addOnRatePercent) < 0.001);
  return entry ? entry.contractualRate : null;
}

export interface LoanFeeWaivers {
  accountManagementFee: boolean;
  processingFee: boolean;
  digitalSignatureFee: boolean;
  notarialFee: boolean;
  insuranceFee: boolean;
  advanceInterestFee: boolean;
  /** Not part of the official calculator's own toggle set (that fee is product-configured, always-applied there) — added per MIS request, defaulted to waived (see `DEFAULT_FEE_WAIVERS`). */
  documentaryStampTax: boolean;
}

/** "Waive nothing" baseline — every fee charged. */
export const NO_FEES_WAIVED: LoanFeeWaivers = {
  accountManagementFee: false,
  processingFee: false,
  digitalSignatureFee: false,
  notarialFee: false,
  insuranceFee: false,
  advanceInterestFee: false,
  documentaryStampTax: false,
};

/** The Create Loan Account form's actual starting toggle state — Documentary Stamp Tax defaults to waived; every other fee defaults to charged. */
export const DEFAULT_FEE_WAIVERS: LoanFeeWaivers = { ...NO_FEES_WAIVED, documentaryStampTax: true };

export interface LoanOriginationParams {
  principal: number;
  /** Officer-entered Add-On Rate — looked up against `INTEREST_RATE_CHART` for the Contractual Rate actually used to run the schedule. */
  addOnRatePercent: number;
  termMonths: number;
  /** The product's other configured fees (e.g. Documentary Stamp Tax, Credit Investigation Fee) — always applied, no per-fee waive evidenced for these. Its "Processing Fee" entry supplies the processing fee's own rate/flat amount. */
  productFeeRules: MockFeeRule[];
  disbursementDate: string;
  firstRepaymentDate: string;
  /** For loan renewals — the prior loan's remaining balance, paid off out of this loan's proceeds. `0` for a brand-new client. */
  previousLoanOutstandingBalance: number;
  waive: LoanFeeWaivers;
}

export interface LoanOriginationSummary {
  contractualRatePercent: number;
  /** `false` when no exact Interest Rate Chart entry exists for this term/add-on combination and the Add-On Rate was used as a fallback — flagged, never silently guessed. */
  contractualRateFromChart: boolean;
  monthlyPayment: number;
  totalInterest: number;
  /** Sum of every installment's amortization — matches the legacy `Obligation` field. */
  obligation: number;
  fees: {
    accountManagementFee: number;
    processingFee: number;
    digitalSignatureFee: number;
    notarialFee: number;
    insuranceFee: number;
    advanceInterestFee: number;
  };
  /** The product's other configured fees (e.g. Documentary Stamp Tax) — see `LoanOriginationParams.productFeeRules`. */
  otherProductFees: { name: string; amount: number }[];
  totalFees: number;
  previousLoanOutstandingBalance: number;
  /** `totalFees + previousLoanOutstandingBalance` — matches the legacy `Other Bank Charges/Deductions Collected` field. */
  totalDeduction: number;
  netProceeds: number;
  addOnMonthlyRatePercent: number;
  addOnAnnualRatePercent: number;
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

/**
 * Live "how much will this loan actually cost/disburse" preview for the Create Loan Account form
 * — reproduces the real official calculator
 * (`legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx`, `manual input for LOAN
 * AMOUNT` sheet) field-for-field, including its per-fee Waive toggle (column H: `NO` zeroes the
 * fee out entirely) and its Advance Interest / Insurance Fee formulas, which are otherwise
 * undocumented anywhere in this codebase:
 *
 * - Contractual Rate: exact lookup against `INTEREST_RATE_CHART` (sheet `Interest Rate Chart`),
 *   not a formula — see `lookupContractualRate()`.
 * - Monthly Amortization: `PMT` — `CALCULATION_ENGINE_SPEC.md` §2 (CONFIRMED).
 * - Account Management Fee = Principal × 1% (cell `G3`, fixed rate, not product-configurable).
 * - Processing Fee = the product's own `Processing Fee` rule (flat or % of principal — `G5`).
 * - Digital Signature Fee / Notarial Fee = flat ₱500 each (cells `G6`/`G7`). The `Loans_details`
 *   master ledger in `OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm` records the same ₱500
 *   Notarial Fee but under an older name for the Digital Signature Fee — `Web fee` — real
 *   disbursed loans there show both flat ₱500 charges simultaneously on the same account,
 *   confirming these are two distinct fees, not the same fee double-counted.
 * - Advance Interest Fee (cell `G4`) — a partial-period interest charge, `0` unless the gap
 *   between disbursement and the first repayment date exceeds 30 days:
 *   `Principal × (AddOnRate/100) × ((DaysBetween − 30) / 30)`. Same shape as
 *   `CALCULATION_ENGINE_SPEC.md` §8's day-count formula, confirmed independently here against a
 *   second, later-discovered legacy source.
 * - Insurance Fee (cell `G8`) = `(Obligation / 1000) × TermMonths`, `+20` if `Obligation < 50,000`
 *   — `Obligation = MonthlyAmortization × TermMonths` (cell `G17`/`G19`).
 * - Net Proceeds = Principal − (all fees + any outstanding balance from a previous loan being
 *   renewed/consolidated) — cells `G9`/`G10`.
 *
 * Every fee toggle mirrors the real form's `H` column: `waive.<fee> = true` reproduces typing
 * `"NO"` in that column, zeroing the fee out entirely (never adjusting the rate to compensate).
 */
export function computeLoanOriginationSummary(params: LoanOriginationParams): LoanOriginationSummary {
  const { principal, addOnRatePercent, termMonths, productFeeRules, disbursementDate, firstRepaymentDate, previousLoanOutstandingBalance, waive } = params;

  const chartRate = lookupContractualRate(termMonths, addOnRatePercent);
  const contractualRatePercent = chartRate ?? addOnRatePercent;
  const contractualRateFromChart = chartRate !== null;

  const r = contractualRatePercent / 100;
  const monthlyPayment =
    termMonths > 0 && r > 0
      ? round2((r * principal) / (1 - Math.pow(1 + r, -termMonths)))
      : round2(principal / Math.max(termMonths, 1));
  const totalInterest = round2(monthlyPayment * termMonths - principal);
  const obligation = round2(monthlyPayment * termMonths);

  const accountManagementFee = waive.accountManagementFee ? 0 : round2(principal * 0.01);

  const processingFeeRule = productFeeRules.find((f) => f.name === 'Processing Fee');
  const processingFee = waive.processingFee || !processingFeeRule
    ? 0
    : processingFeeRule.computation === 'FLAT'
      ? processingFeeRule.value
      : round2(principal * (processingFeeRule.value / 100));

  const digitalSignatureFee = waive.digitalSignatureFee ? 0 : 500;
  const notarialFee = waive.notarialFee ? 0 : 500;

  const daysToFirstRepayment = daysBetweenIso(disbursementDate, firstRepaymentDate);
  const advanceInterestFee =
    waive.advanceInterestFee || daysToFirstRepayment <= 30
      ? 0
      : round2(principal * (addOnRatePercent / 100) * ((daysToFirstRepayment - 30) / 30));

  const insuranceFee = waive.insuranceFee
    ? 0
    : round2(obligation < 50000 ? (obligation / 1000) * termMonths + 20 : (obligation / 1000) * termMonths);

  const otherProductFees = productFeeRules
    .filter((f) => f.name !== 'Processing Fee')
    .map((f) => ({
      name: f.name,
      amount:
        f.name === 'Documentary Stamp Tax' && waive.documentaryStampTax
          ? 0
          : f.computation === 'FLAT'
            ? f.value
            : round2(principal * (f.value / 100)),
    }));
  const otherProductFeesTotal = round2(otherProductFees.reduce((sum, f) => sum + f.amount, 0));

  const fees = { accountManagementFee, processingFee, digitalSignatureFee, notarialFee, insuranceFee, advanceInterestFee };
  const totalFees = round2(Object.values(fees).reduce((sum, v) => sum + v, 0) + otherProductFeesTotal);
  const totalDeduction = round2(totalFees + previousLoanOutstandingBalance);
  const netProceeds = round2(principal - totalDeduction);

  const addOnMonthlyRatePercent = principal > 0 && termMonths > 0 ? round2((totalInterest / principal / termMonths) * 100) : 0;
  const addOnAnnualRatePercent = round2(addOnMonthlyRatePercent * 12);

  return {
    contractualRatePercent,
    contractualRateFromChart,
    monthlyPayment,
    totalInterest,
    obligation,
    fees,
    otherProductFees,
    totalFees,
    previousLoanOutstandingBalance,
    totalDeduction,
    netProceeds,
    addOnMonthlyRatePercent,
    addOnAnnualRatePercent,
  };
}

function buildSchedule(
  loanId: string,
  principal: number,
  monthlyRate: number,
  installmentCount: number,
  firstRepaymentDate: Date,
  paidThroughInstallments: number,
  lastInstallmentPartialFraction: number,
): MockRepaymentInstallment[] {
  // Simplified level-payment amortization, mirroring CALC-SPEC §2's PMT
  // formula shape, for presentation purposes only — not a reimplementation
  // consumed by anything financial.
  const r = monthlyRate / 100;
  const payment = (r * principal) / (1 - Math.pow(1 + r, -installmentCount));
  let balance = principal;
  const rows: MockRepaymentInstallment[] = [];

  for (let n = 1; n <= installmentCount; n++) {
    const interest = round2(balance * r);
    const principalPortion = round2(payment - interest);
    balance = round2(balance - principalPortion);

    const isFullyPaid = n <= paidThroughInstallments;
    const isPartial = n === paidThroughInstallments + 1 && lastInstallmentPartialFraction > 0;
    const dueDate = addMonths(firstRepaymentDate, n - 1);
    const isLate = !isFullyPaid && dueDate.getTime() < Date.now();

    rows.push({
      id: `${loanId}-inst-${n}`,
      loanAccountId: loanId,
      installmentNumber: n,
      dueDate: dueDate.toISOString(),
      due: { principal: principalPortion, interest, fees: 0, penalty: 0 },
      paid: isFullyPaid
        ? { principal: principalPortion, interest, fees: 0, penalty: 0 }
        : isPartial
          ? {
              principal: round2(principalPortion * lastInstallmentPartialFraction),
              interest: round2(interest * lastInstallmentPartialFraction),
              fees: 0,
              penalty: 0,
            }
          : { principal: 0, interest: 0, fees: 0, penalty: 0 },
      status: isFullyPaid ? 'PAID' : isPartial ? 'PARTIALLY_PAID' : isLate ? 'LATE' : 'PENDING',
    });
  }
  return rows;
}

interface GeneratedLoan {
  loan: MockLoanAccount;
  installments: MockRepaymentInstallment[];
  timeline: MockStatusEvent[];
}

function generateLoan(
  index: number,
  borrowerName: string,
  status: LoanAccountStatus,
  hasPenalty: boolean,
  forcedDiscontinuedProductCode?: string,
  forcedPaymentMethodCode?: string,
): GeneratedLoan {
  const catalogEntry = forcedDiscontinuedProductCode
    ? findDiscontinuedCatalogEntry(forcedDiscontinuedProductCode)
    : pick(LOAN_GENERATION_CATALOG);
  const product = catalogEntry.product;
  const branch = pick(BRANCHES);
  const officer = pick(LOAN_OFFICERS);
  const id = `loan-${index + 1}`;
  const loanCode = nextLoanCode(catalogEntry.codePrefix);

  const principal = round2(15000 + rng() * 85000);
  const installmentCount = status === 'MATURED' ? pick([6, 9, 12]) : pick([6, 9, 12, 18, 24]);
  // Spread originations from ~3 weeks to ~23 months ago so recent months are
  // populated too — the Dashboard's "last 6 months" disbursement bars drill
  // down to accounts activated in the clicked month, which must not be
  // permanently empty (originally 200+ days minimum, i.e. nothing recent).
  // MATURED loans are the exception: they must sit past their full maturity
  // date, so their origination is pushed back the whole term plus a buffer.
  const createdAt =
    status === 'MATURED'
      ? new Date(Date.now() - (installmentCount + 3) * 30 * 86_400_000)
      : new Date(Date.now() - (21 + Math.floor(rng() * 680)) * 86_400_000);
  const approvedAt = new Date(createdAt.getTime() + 2 * 86_400_000);
  const firstRepaymentDate = addMonths(approvedAt, 1);

  const isActivated = status !== 'PENDING_APPROVAL' && status !== 'APPROVED' && status !== 'CLOSED_REJECTED';
  const activatedAt = isActivated ? approvedAt : null;

  const paidThrough =
    status === 'CLOSED'
      ? installmentCount
      : status === 'ACTIVE_IN_ARREARS'
        ? Math.max(0, Math.floor(installmentCount * 0.2))
        : status === 'MATURED'
          ? Math.max(1, Math.floor(installmentCount * 0.6))
          : status === 'ACTIVE'
            ? Math.max(0, Math.floor(installmentCount * (0.3 + rng() * 0.4)))
            : 0;
  const partialFraction =
    status === 'ACTIVE' || status === 'ACTIVE_IN_ARREARS' || status === 'MATURED' ? round2(0.2 + rng() * 0.5) : 0;

  const installments = isActivated
    ? buildSchedule(id, principal, product.defaultInterestRate, installmentCount, firstRepaymentDate, paidThrough, partialFraction)
    : [];

  const principalDue = isActivated ? principal : 0;
  const interestDue = isActivated ? round2(installments.reduce((sum, i) => sum + i.due.interest, 0)) : 0;
  // A fully-closed (paid-in-full) loan must reconcile to an exact zero
  // balance for this preview's display purposes — using `principalDue`
  // directly here (rather than re-summing `installments[].paid.principal`)
  // sidesteps the PMT amortization's well-known few-centavo rounding
  // residue (see `CALCULATION_ENGINE_SPEC.md` §2's own documented
  // limitation) so a "Closed" loan never shows a stray -₱0.0x balance.
  const principalPaid = status === 'CLOSED' ? principalDue : round2(installments.reduce((sum, i) => sum + i.paid.principal, 0));
  const interestPaid = status === 'CLOSED' ? interestDue : round2(installments.reduce((sum, i) => sum + i.paid.interest, 0));
  const feesDue = product.productCode === 'BL-REGULAR' ? round2(principal * 0.02) : 0;
  const penaltyBalance = hasPenalty ? round2(500 + rng() * 4500) : 0;

  const balances: MockLoanBalances = {
    principalBalance: round2(principalDue - principalPaid),
    principalPaid,
    principalDue,
    interestBalance: round2(interestDue - interestPaid),
    interestPaid,
    interestDue,
    feesBalance: status === 'CLOSED' ? 0 : feesDue,
    feesPaid: status === 'CLOSED' ? feesDue : 0,
    feesDue,
    penaltyBalance,
    penaltyPaid: 0,
    penaltyDue: penaltyBalance,
  };

  const accountingBalance = round2(balances.principalBalance + balances.interestBalance + balances.feesBalance);
  const collectionsBalance = round2(accountingBalance + balances.penaltyBalance);

  const closedAt = status === 'CLOSED' || status === 'CLOSED_WRITTEN_OFF' || status === 'CLOSED_REJECTED' ? new Date() : null;

  const timeline: MockStatusEvent[] = [
    { status: 'PENDING_APPROVAL', label: 'Application submitted', at: createdAt.toISOString(), actor: officer },
  ];
  if (status !== 'PENDING_APPROVAL') {
    timeline.push({ status: 'APPROVED', label: 'Approved', at: approvedAt.toISOString(), actor: officer });
  }
  if (isActivated) {
    timeline.push({ status: 'DISBURSED', label: 'Disbursed / Activated', at: approvedAt.toISOString(), actor: officer });
  }
  if (status === 'ACTIVE_IN_ARREARS') {
    timeline.push({
      status: 'ACTIVE_IN_ARREARS',
      label: 'Flagged in arrears',
      at: new Date().toISOString(),
      actor: 'System (overdue installment)',
    });
  }
  if (status === 'MATURED') {
    timeline.push({
      status: 'MATURED',
      label: 'Reached maturity date — balance still outstanding',
      at: new Date().toISOString(),
      actor: 'System (past maturity)',
    });
  }
  if (closedAt) {
    timeline.push({ status, label: status === 'CLOSED' ? 'Fully settled' : 'Closed', at: closedAt.toISOString(), actor: officer });
  }

  const paymentMethod = forcedPaymentMethodCode ?? pick(ACTIVE_PAYMENT_METHODS).code;
  const isCashInArrears = paymentMethod === 'CASH' && status === 'ACTIVE_IN_ARREARS';

  const loan: MockLoanAccount = {
    id,
    loanCode,
    borrowerName,
    branchId: branch.id,
    branchName: branch.name,
    loanOfficerName: officer,
    productId: product.id,
    productType: product.productName,
    isDiscontinuedProduct: !product.isActive,
    status,
    principalAmount: principal,
    interestRate: product.defaultInterestRate,
    installmentCount,
    firstRepaymentDate: firstRepaymentDate.toISOString(),
    balances,
    collectionsBalance,
    accountingBalance,
    approvedAt: status === 'PENDING_APPROVAL' ? null : approvedAt.toISOString(),
    activatedAt: activatedAt?.toISOString() ?? null,
    closedAt: closedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    paymentMethod,
    collectionAgentName: isCashInArrears ? pick(COLLECTION_AGENTS) : undefined,
    atmCardOnFile: paymentMethod === 'AUTO_DEBIT' ? true : undefined,
  };

  return { loan, installments, timeline };
}

const STATUS_PLAN: {
  status: LoanAccountStatus;
  hasPenalty: boolean;
  forcedDiscontinuedProductCode?: string;
  forcedPaymentMethodCode?: string;
}[] = [
  { status: 'ACTIVE', hasPenalty: false },
  { status: 'ACTIVE', hasPenalty: false },
  // Two Active-Matured accounts (red Venn segment): reached the end of their
  // full term but still carry an outstanding balance — the highest-risk active
  // category, distinct from a successfully-settled CLOSED loan.
  { status: 'MATURED', hasPenalty: true },
  { status: 'MATURED', hasPenalty: true, forcedDiscontinuedProductCode: 'SML-Max' },
  // Forced onto AUTO_DEBIT so the "ATM Card on File" indicator is always
  // visible in this preview, not left to chance.
  { status: 'ACTIVE', hasPenalty: false, forcedPaymentMethodCode: 'AUTO_DEBIT' },
  { status: 'ACTIVE', hasPenalty: false },
  // Deliberately forced onto a DISCONTINUED product (per this checkpoint's
  // requirement to show a real client whose loan status is still
  // ACTIVE/ACTIVE_IN_ARREARS under a product that is no longer offered).
  // Also forced onto CASH so the "Assigned Collection Agent" field (only
  // shown for CASH + ACTIVE_IN_ARREARS) is always demonstrated, not left
  // to chance.
  { status: 'ACTIVE_IN_ARREARS', hasPenalty: true, forcedDiscontinuedProductCode: 'SML-Regular', forcedPaymentMethodCode: 'CASH' },
  { status: 'ACTIVE_IN_ARREARS', hasPenalty: true },
  { status: 'ACTIVE_IN_ARREARS', hasPenalty: true },
  { status: 'ACTIVE_IN_ARREARS', hasPenalty: true, forcedDiscontinuedProductCode: 'SML-Max' },
  { status: 'CLOSED', hasPenalty: false },
  { status: 'CLOSED', hasPenalty: false },
  { status: 'CLOSED', hasPenalty: false },
  { status: 'CLOSED', hasPenalty: false },
  { status: 'APPROVED', hasPenalty: false },
  { status: 'APPROVED', hasPenalty: false },
  { status: 'PENDING_APPROVAL', hasPenalty: false },
  { status: 'PENDING_APPROVAL', hasPenalty: false },
];

const GENERATED = BORROWER_NAMES.map((name, i) =>
  generateLoan(
    i,
    name,
    STATUS_PLAN[i]!.status,
    STATUS_PLAN[i]!.hasPenalty,
    STATUS_PLAN[i]!.forcedDiscontinuedProductCode,
    STATUS_PLAN[i]!.forcedPaymentMethodCode,
  ),
);

export const MOCK_LOANS: MockLoanAccount[] = GENERATED.map((g) => g.loan);
export const MOCK_INSTALLMENTS: Record<string, MockRepaymentInstallment[]> = Object.fromEntries(
  GENERATED.map((g) => [g.loan.id, g.installments]),
);
export const MOCK_TIMELINES: Record<string, MockStatusEvent[]> = Object.fromEntries(GENERATED.map((g) => [g.loan.id, g.timeline]));

export function getMockLoan(id: string): MockLoanAccount | undefined {
  return MOCK_LOANS.find((l) => l.id === id);
}

// ---------------------------------------------------------------------------
// Dashboard aggregates — all derived from MOCK_LOANS above, all sample data.
// ---------------------------------------------------------------------------

/** All still-active (not closed/rejected/written-off) loan statuses — ACTIVE, in arrears, and past-maturity-but-unpaid. */
const ACTIVE_LOAN_STATUSES: LoanAccountStatus[] = ['ACTIVE', 'ACTIVE_IN_ARREARS', 'MATURED'];

export const DASHBOARD_SUMMARY = {
  totalActiveLoans: MOCK_LOANS.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status)).length,
  totalPortfolioValue: round2(
    MOCK_LOANS.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status)).reduce((sum, l) => sum + l.balances.principalBalance, 0),
  ),
  totalCollectionsThisMonth: round2(1_245_320 + rng() * 50_000),
  overdueAccounts: MOCK_LOANS.filter((l) => l.status === 'ACTIVE_IN_ARREARS').length,
  overdueAmount: round2(MOCK_LOANS.filter((l) => l.status === 'ACTIVE_IN_ARREARS').reduce((sum, l) => sum + l.collectionsBalance, 0)),
};

const MONTH_LABELS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Loan Disbursement Trend — a real bottom-up sum of `principalAmount` for every loan whose
 * `activatedAt` falls in each of the last `monthsBack` calendar months, not a fabricated series.
 * Exported as a reusable builder so the Dashboard can recompute it against a filtered loan subset
 * (by category and/or origination date range), same as the other portfolio widgets.
 */
export function buildDisbursementTrend(
  loans: MockLoanAccount[],
  monthsBack = 6,
): { month: string; year: number; monthIndex: number; disbursed: number }[] {
  const now = new Date();
  const buckets: { month: string; year: number; monthIndex: number; disbursed: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let disbursed = 0;
    for (const loan of loans) {
      if (!loan.activatedAt) continue;
      const activated = new Date(loan.activatedAt);
      if (activated.getFullYear() === target.getFullYear() && activated.getMonth() === target.getMonth()) {
        disbursed += loan.principalAmount;
      }
    }
    buckets.push({
      month: MONTH_SHORT_NAMES[target.getMonth()]!,
      year: target.getFullYear(),
      monthIndex: target.getMonth(),
      disbursed: round2(disbursed),
    });
  }
  return buckets;
}

/** Portfolio-wide baseline (no filter applied). */
export const DISBURSEMENT_TREND = buildDisbursementTrend(MOCK_LOANS);

export const COLLECTIONS_VS_TARGET = MONTH_LABELS.map((month) => ({
  month,
  target: round2(1_100_000 + rng() * 40_000),
  actual: round2(950_000 + rng() * 250_000),
}));

/**
 * Groups a loan into one of the 3 ACTIVE loan product categories for dashboard
 * analytics: Salary Loan, Seafarer Loan, Business Loan. Every SML-* product
 * (active or discontinued — SML-Regular, SML-Max, etc.) is a sub-class of
 * Seafarer Loan (a.k.a. Seaman Loan), confirmed business detail — the dashboard
 * must never present SML as its own top-level category. Anything outside the
 * three families (legacy PFL/REL/CL/... products) falls into "Other (Legacy)"
 * so no loan silently disappears from a chart total.
 */
export function getDashboardLoanCategory(loan: MockLoanAccount): string {
  const name = loan.productType;
  if (name.startsWith('Seafarer Loan') || name.startsWith('SML')) return 'Seafarer Loan';
  if (name.startsWith('Salary Loan') || /^SL[-_ ]/.test(name)) return 'Salary Loan';
  if (name.startsWith('Business Loan') || /^BL[-_ ]/.test(name)) return 'Business Loan';
  return 'Other (Legacy)';
}

/**
 * Collections Forecast — a bottom-up cash-flow projection, not a top-down statistical model.
 * Rather than extrapolating a trend line from past collections (which has no idea what's
 * actually contractually due), this sums the real scheduled installment amounts (principal +
 * interest + fees + penalty, from each active loan's own `MOCK_INSTALLMENTS` schedule) falling
 * due in each of the next 4 months — a number the business can already know exactly, since every
 * active loan's repayment schedule is fixed at origination — then applies the portfolio's own
 * recent collection-realization rate (average actual/target from `COLLECTIONS_VS_TARGET`) to
 * account for the reality that not everything scheduled is actually collected on time. This is
 * the standard approach for a loan portfolio (known future amortization × a realistic collection
 * rate) and is far more defensible than fitting a curve to historical totals alone. Still
 * labeled "Sample Projection" in the UI — real historical collection-rate data, not a fitted
 * statistical model, and the realization rate here is a simple average, not a trend/seasonality-
 * aware estimate (see the in-app note for what a further-improved version would add).
 */
function buildCollectionsForecast(monthsAhead = 4): { month: string; projected: number; scheduledDue: number }[] {
  const activeLoans = MOCK_LOANS.filter((l) => ACTIVE_LOAN_STATUSES.includes(l.status));
  const realizationRate =
    COLLECTIONS_VS_TARGET.reduce((sum, m) => sum + (m.target > 0 ? m.actual / m.target : 1), 0) / COLLECTIONS_VS_TARGET.length;
  const now = new Date();
  const forecast: { month: string; projected: number; scheduledDue: number }[] = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
    let scheduledDue = 0;
    for (const loan of activeLoans) {
      for (const inst of MOCK_INSTALLMENTS[loan.id] ?? []) {
        const due = new Date(inst.dueDate);
        if (due.getFullYear() === target.getFullYear() && due.getMonth() === target.getMonth()) {
          scheduledDue += inst.due.principal + inst.due.interest + inst.due.fees + inst.due.penalty;
        }
      }
    }
    forecast.push({
      month: MONTH_SHORT_NAMES[target.getMonth()]!,
      scheduledDue: round2(scheduledDue),
      projected: round2(scheduledDue * realizationRate),
    });
  }
  return forecast;
}

/** Clearly labeled as a sample projection in the UI — see `buildCollectionsForecast`'s doc comment for the methodology. */
export const SAMPLE_COLLECTIONS_PROJECTION = buildCollectionsForecast();

// ---------------------------------------------------------------------------
// Client Data — borrower profiles. Same 18 real names as MOCK_LOANS, plus
// fabricated contact/employment details so the Client Data screen has
// something to display. Linked back to MOCK_LOANS by borrowerName.
// ---------------------------------------------------------------------------

export interface MockBorrowerProfile {
  id: string;
  name: string;
  /** Path under `public/` — a real applicant photo from `legacy/sdevtech/`, cycled across clients for this preview (not necessarily the same real individual as the name — see the Client Data section note in the codebase for why that's an acceptable placeholder choice here). */
  profilePictureUrl?: string;
  contactNumber: string;
  email: string;
  address: string;
  employer: string;
  position: string;
  monthlyIncome: number;
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated';
  dateOfBirth: string;
  homeBranchName: string;
  loanIds: string[];
  /** File name/size/type only — same "no real document content shown" rule as Loan Applications above. */
  attachments: MockUploadedFile[];
}

const APPLICANT_PHOTO_COUNT = 12;
const CLIENT_ATTACHMENT_NAMES = [
  'Valid ID (Front).jpg',
  'Valid ID (Back).jpg',
  'Proof of Billing.jpg',
  'Certificate of Employment.pdf',
  'Signed Loan Agreement.pdf',
];

function buildClientAttachments(id: string): MockUploadedFile[] {
  return CLIENT_ATTACHMENT_NAMES.map((fileName, i) => ({
    id: `${id}-att-${i}`,
    fileName,
    sizeKb: Math.round(60 + rng() * 2200),
    uploadedAt: new Date(Date.now() - (400 + i * 5) * 86_400_000).toISOString(),
  }));
}

const EMPLOYERS = [
  'SM Investments Corp.',
  'Jollibee Foods Corp.',
  'Ayala Land Inc.',
  'PLDT Inc.',
  'BDO Unibank',
  'San Miguel Corp.',
  'Self-Employed / Sari-Sari Store',
  'Overseas — Maritime Vessel',
];
const POSITIONS = ['Rank & File', 'Supervisor', 'Team Lead', 'Manager', 'Owner/Proprietor', 'Seafarer (Able Seaman)'];
const CITIES = ['Makati City', 'Quezon City', 'Cebu City', 'Davao City', 'Pasig City', 'Taguig City'];

function generateBorrowerProfile(index: number, name: string): MockBorrowerProfile {
  const id = `borrower-${index + 1}`;
  const loans = MOCK_LOANS.filter((l) => l.borrowerName === name);
  const birthYear = 1965 + Math.floor(rng() * 40);
  const birthMonth = 1 + Math.floor(rng() * 12);
  const birthDay = 1 + Math.floor(rng() * 28);

  return {
    id,
    name,
    profilePictureUrl: `/applicants/applicant-${(index % APPLICANT_PHOTO_COUNT) + 1}.jpg`,
    contactNumber: `09${Math.floor(100000000 + rng() * 800000000)}`,
    email: `${name
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()
      .replace(/\s+/g, '.')}@sample-mail.example`,
    address: `${Math.floor(1 + rng() * 900)} ${pick(['Rizal', 'Bonifacio', 'Mabini', 'Del Pilar', 'Aguinaldo'])} St., ${pick(CITIES)}`,
    employer: pick(EMPLOYERS),
    position: pick(POSITIONS),
    monthlyIncome: round2(18000 + rng() * 62000),
    civilStatus: pick(['Single', 'Married', 'Widowed', 'Separated']),
    dateOfBirth: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay)).toISOString(),
    homeBranchName: loans[0]?.branchName ?? pick(BRANCHES).name,
    loanIds: loans.map((l) => l.id),
    attachments: buildClientAttachments(id),
  };
}

export const MOCK_BORROWERS: MockBorrowerProfile[] = BORROWER_NAMES.map((name, i) => generateBorrowerProfile(i, name));

export function getMockBorrower(id: string): MockBorrowerProfile | undefined {
  return MOCK_BORROWERS.find((b) => b.id === id);
}

/** Finds the Client Data profile a loan account belongs to, so its borrower name can link there. */
export function getMockBorrowerForLoan(loan: MockLoanAccount): MockBorrowerProfile | undefined {
  return MOCK_BORROWERS.find((b) => b.loanIds.includes(loan.id));
}

// ---------------------------------------------------------------------------
// Repeat-client historical loans — confirmed per this checkpoint: the Loan
// Application detail page must flag when an applicant is already an
// existing client, list their previous Easycash loan account(s), and let
// the AI Risk Assessment summary reference whether that history shows a
// good payer or a delinquent one (with pattern + reason when delinquent).
// These two records exist purely to demonstrate both outcomes live —
// Stephanie Salazar Antoy (good payer, paid in full) and Mary Grace Dalapo
// Gallardo (delinquent, written off) both also appear as fictional-photo
// Loan Applications above, so opening either application shows this
// history in action.
// ---------------------------------------------------------------------------

function buildHistoricalClientLoan(params: {
  borrowerName: string;
  loanCode: string;
  principal: number;
  monthlyRate: number;
  installmentCount: number;
  monthsAgoStarted: number;
  paidThroughInstallments: number;
  finalStatus: 'CLOSED' | 'CLOSED_WRITTEN_OFF';
  productIndex: number;
}): { loan: MockLoanAccount; installments: MockRepaymentInstallment[] } {
  const id = `loan-repeat-${slugify(params.borrowerName)}`;
  const createdAt = new Date(Date.now() - params.monthsAgoStarted * 30 * 86_400_000);
  const firstRepaymentDate = addMonths(createdAt, 1);
  const installments = buildSchedule(
    id,
    params.principal,
    params.monthlyRate,
    params.installmentCount,
    firstRepaymentDate,
    params.paidThroughInstallments,
    0,
  );
  const principalPaid = round2(installments.reduce((sum, i) => sum + i.paid.principal, 0));
  const interestPaid = round2(installments.reduce((sum, i) => sum + i.paid.interest, 0));
  const interestDue = round2(installments.reduce((sum, i) => sum + i.due.interest, 0));
  const isWrittenOff = params.finalStatus === 'CLOSED_WRITTEN_OFF';

  const loan: MockLoanAccount = {
    id,
    loanCode: params.loanCode,
    borrowerName: params.borrowerName,
    branchId: BRANCHES[0]!.id,
    branchName: BRANCHES[0]!.name,
    loanOfficerName: pick(LOAN_OFFICERS),
    productId: ACTIVE_PRODUCTS[params.productIndex]!.id,
    productType: ACTIVE_PRODUCTS[params.productIndex]!.productName,
    isDiscontinuedProduct: false,
    status: params.finalStatus,
    principalAmount: params.principal,
    interestRate: params.monthlyRate,
    installmentCount: params.installmentCount,
    firstRepaymentDate: firstRepaymentDate.toISOString(),
    balances: {
      principalBalance: isWrittenOff ? round2(params.principal - principalPaid) : 0,
      principalPaid,
      principalDue: params.principal,
      interestBalance: isWrittenOff ? round2(interestDue - interestPaid) : 0,
      interestPaid,
      interestDue,
      feesBalance: 0,
      feesPaid: 0,
      feesDue: 0,
      penaltyBalance: isWrittenOff ? 3200 : 0,
      penaltyPaid: 0,
      penaltyDue: isWrittenOff ? 3200 : 0,
    },
    collectionsBalance: isWrittenOff ? round2(params.principal - principalPaid + (interestDue - interestPaid) + 3200) : 0,
    accountingBalance: isWrittenOff ? round2(params.principal - principalPaid + (interestDue - interestPaid)) : 0,
    approvedAt: createdAt.toISOString(),
    activatedAt: createdAt.toISOString(),
    closedAt: addMonths(createdAt, params.installmentCount + 1).toISOString(),
    createdAt: createdAt.toISOString(),
    paymentMethod: 'GCASH',
  };
  return { loan, installments };
}

const REPEAT_CLIENT_LOAN_1 = buildHistoricalClientLoan({
  borrowerName: 'Stephanie Salazar Antoy',
  loanCode: 'SL-Reg_0900',
  principal: 60000,
  monthlyRate: 4.5,
  installmentCount: 12,
  monthsAgoStarted: 20,
  paidThroughInstallments: 12,
  finalStatus: 'CLOSED',
  productIndex: 1,
});

const REPEAT_CLIENT_LOAN_2 = buildHistoricalClientLoan({
  borrowerName: 'Mary Grace Dalapo Gallardo',
  loanCode: 'BL-Reg_0900',
  principal: 120000,
  monthlyRate: 3.8,
  installmentCount: 18,
  monthsAgoStarted: 26,
  paidThroughInstallments: 7,
  finalStatus: 'CLOSED_WRITTEN_OFF',
  productIndex: 3,
});

for (const { loan, installments } of [REPEAT_CLIENT_LOAN_1, REPEAT_CLIENT_LOAN_2]) {
  MOCK_LOANS.push(loan);
  MOCK_INSTALLMENTS[loan.id] = installments;
  MOCK_TIMELINES[loan.id] = [
    { status: 'PENDING_APPROVAL', label: 'Application submitted', at: loan.createdAt, actor: loan.loanOfficerName },
    { status: 'APPROVED', label: 'Approved', at: loan.createdAt, actor: loan.loanOfficerName },
    { status: 'DISBURSED', label: 'Disbursed / Activated', at: loan.createdAt, actor: loan.loanOfficerName },
    { status: loan.status, label: loan.status === 'CLOSED' ? 'Fully settled' : 'Written off', at: loan.closedAt!, actor: loan.loanOfficerName },
  ];
}

/**
 * Loan Portfolio Health (Dashboard Venn diagram) — three business-defined segments, all
 * derived from MOCK_LOANS's existing `status`/`balances` fields, no new mock records. Computed
 * here, after every loan has been pushed onto `MOCK_LOANS`, so no bucket is computed against a
 * stale, incomplete array.
 * - Good: `ACTIVE`, paying on schedule, no penalty fees.
 * - Active in Arrears (the Venn overlap): `ACTIVE_IN_ARREARS` — still active and still paying,
 *   just sometimes late, so the company earns penalty/late-fee income on top of amortization
 *   (confirmed business intent — not a data-quality problem to "fix away"). "In arrears" is the
 *   industry-standard term: overdue on one or more installments, but not in default.
 * - Matured (red circle): `MATURED` — reached the end of the full term but still unpaid, carrying
 *   an outstanding balance; still active, not written off. The highest-risk active segment.
 *   Deliberately NOT the same as `CLOSED` (which reached maturity AND settled successfully — a
 *   separate, healthy outcome that is not shown as a Venn circle).
 * Written-off loans (`CLOSED_WRITTEN_OFF`) are not a Venn segment either, but are carried here as
 * `writtenOff` for the Write-off exposure quality metric and its drill-down.
 * Each bucket carries its `loans` array so charts can drill down to the exact accounts behind
 * every figure.
 */
function sumLoans(loans: MockLoanAccount[], pick: (l: MockLoanAccount) => number): number {
  return round2(loans.reduce((total, l) => total + pick(l), 0));
}

export interface PortfolioHealthBucket {
  count: number;
  collectionsBalance: number;
  loans: MockLoanAccount[];
}

/**
 * Builds the Loan Portfolio Health buckets from any given loan array — used both for the
 * portfolio-wide baseline (`PORTFOLIO_HEALTH` below) and for the Dashboard's filtered view
 * (by category/date range), so the Venn diagram's totals stay accurate under any filter.
 */
export function buildPortfolioHealth(loans: MockLoanAccount[]) {
  const good = loans.filter((l) => l.status === 'ACTIVE');
  const arrears = loans.filter((l) => l.status === 'ACTIVE_IN_ARREARS');
  const matured = loans.filter((l) => l.status === 'MATURED');
  const writtenOff = loans.filter((l) => l.status === 'CLOSED_WRITTEN_OFF');
  return {
    good: {
      count: good.length,
      collectionsBalance: sumLoans(good, (l) => l.collectionsBalance),
      // Interest Income — the realized interest revenue already collected from these performing
      // accounts. The primary revenue source of the lending business.
      interestIncome: sumLoans(good, (l) => l.balances.interestPaid),
      loans: good,
    },
    activeInArrears: {
      count: arrears.length,
      collectionsBalance: sumLoans(arrears, (l) => l.collectionsBalance),
      penaltyIncome: sumLoans(arrears, (l) => l.balances.penaltyPaid + l.balances.penaltyBalance),
      // Accrued Revenue — interest the loan has earned that the client should have paid but has
      // not yet remitted (accrued interest income, still expected to come in). Penalty/late-fee
      // income is tracked separately as `penaltyIncome`.
      accruedRevenue: sumLoans(arrears, (l) => l.balances.interestBalance),
      loans: arrears,
    },
    matured: {
      count: matured.length,
      collectionsBalance: sumLoans(matured, (l) => l.collectionsBalance),
      // Credit Loss — the unpaid principal at risk of never being recovered now that the loan
      // has run past its full maturity date (Loan Loss exposure, one step short of a formal
      // write-off).
      creditLoss: sumLoans(matured, (l) => l.balances.principalBalance),
      loans: matured,
    },
    writtenOff: {
      count: writtenOff.length,
      collectionsBalance: sumLoans(writtenOff, (l) => l.collectionsBalance),
      loans: writtenOff,
    },
  };
}

/** Portfolio-wide baseline (no filter applied) — used by the Recommendation card. */
export const PORTFOLIO_HEALTH = buildPortfolioHealth(MOCK_LOANS);

/**
 * Portfolio Breakdown by Category — outstanding principal of ACTIVE/ACTIVE_IN_ARREARS loans
 * grouped into the 3 active loan product categories (SML rolls up under Seafarer Loan — see
 * `getDashboardLoanCategory`). Carries the loans behind each slice for chart drill-down.
 * Computed here (not next to the other dashboard aggregates) so every pushed loan is included.
 */
export interface PortfolioCategorySlice {
  category: string;
  value: number;
  loans: MockLoanAccount[];
}

/**
 * Groups any given loan array's still-active accounts by loan category. Used both for the
 * portfolio-wide baseline (`PORTFOLIO_BY_CATEGORY` below) and for the Dashboard's filtered view.
 */
export function buildPortfolioByCategory(loans: MockLoanAccount[]): PortfolioCategorySlice[] {
  const byCategory = new Map<string, PortfolioCategorySlice>();
  for (const loan of loans) {
    if (!ACTIVE_LOAN_STATUSES.includes(loan.status)) continue;
    const category = getDashboardLoanCategory(loan);
    const slice = byCategory.get(category) ?? { category, value: 0, loans: [] };
    slice.value = round2(slice.value + loan.balances.principalBalance);
    slice.loans.push(loan);
    byCategory.set(category, slice);
  }
  return [...byCategory.values()];
}

export const PORTFOLIO_BY_CATEGORY = buildPortfolioByCategory(MOCK_LOANS);

/** Distinct loan categories present in the portfolio, for the Dashboard's category filter dropdown. */
export const LOAN_CATEGORY_OPTIONS: string[] = PORTFOLIO_BY_CATEGORY.map((slice) => slice.category);

/**
 * Industry-standard portfolio quality metrics (per the standard definitions popularized on
 * Investopedia). "Delinquent/at-risk" here means overdue but still active — both
 * `ACTIVE_IN_ARREARS` (overdue within term) and `MATURED` (past the full term, still unpaid):
 * - Delinquency Rate — % of active loan accounts that are overdue (count-based).
 * - Portfolio at Risk (PAR) — outstanding balance of overdue loans ÷ total outstanding balance
 *   of the active portfolio (balance-weighted, the more telling of the two).
 * - Average Loan Size — mean original principal across active accounts.
 * Exported as a reusable builder (not just a fixed constant) so the Dashboard can recompute it
 * against a filtered loan subset — every quality metric is meant to move with the Portfolio
 * Filter, not just Portfolio Breakdown / Loan Portfolio Health.
 */
export function buildPortfolioQualityMetrics(loans: MockLoanAccount[]) {
  const health = buildPortfolioHealth(loans);
  const delinquentLoans = [...health.activeInArrears.loans, ...health.matured.loans];
  const activePortfolio = [...health.good.loans, ...delinquentLoans];
  const totalOutstanding = sumLoans(activePortfolio, (l) => l.collectionsBalance);
  const delinquentOutstanding = sumLoans(delinquentLoans, (l) => l.collectionsBalance);
  return {
    delinquencyRatePercent:
      activePortfolio.length === 0 ? 0 : round2((delinquentLoans.length / activePortfolio.length) * 100),
    portfolioAtRiskPercent: totalOutstanding === 0 ? 0 : round2((delinquentOutstanding / totalOutstanding) * 100),
    averageLoanSize:
      activePortfolio.length === 0 ? 0 : round2(activePortfolio.reduce((sum, l) => sum + l.principalAmount, 0) / activePortfolio.length),
    writtenOffExposure: sumLoans(health.writtenOff.loans, (l) => l.collectionsBalance),
  };
}

/** Portfolio-wide baseline (no filter applied). */
export const PORTFOLIO_QUALITY_METRICS = buildPortfolioQualityMetrics(MOCK_LOANS);

// ---------------------------------------------------------------------------
// Generated Documents — no longer a standalone Administration registry.
// Distributed onto each client's own Loan Account instead (see
// `LoanDetailPage`'s Attachments tab), since that's where a loan officer
// actually needs them. The document set comes from the loan's own product's
// `documentTemplates` (see `MockDocumentTemplate` above, editable per product
// in the Loan Products page) plus the Amortization Schedule, which every
// product gets automatically since it's generated from the repayment
// schedule, not a legal template. These only ever exist for an officially
// activated loan account, never for a mere application (same rule as the
// Loan Application attachments cleanup). File contents are NOT included in
// this preview — names/metadata only.
// ---------------------------------------------------------------------------

export interface MockGeneratedDocument {
  id: string;
  documentName: string;
  /** The template code this came from (PN, DS, LA, DOA, DPCF, SPA, or LA-SL/DOA-SL for seafarer loans), or AS for the Amortization Schedule. */
  documentType: string;
  loanId: string;
  loanCode: string;
  borrowerName: string;
  generatedBy: string;
  generatedAt: string;
}

function buildGeneratedDocuments(): MockGeneratedDocument[] {
  const docs: MockGeneratedDocument[] = [];
  for (const loan of MOCK_LOANS) {
    if (!loan.activatedAt) continue;
    const product = getMockLoanProduct(loan.productId);
    const templates = product?.documentTemplates ?? STANDARD_DOCUMENT_TEMPLATES;
    for (const template of templates) {
      docs.push({
        id: `doc-${loan.id}-${slugify(template.code)}`,
        documentName: `${template.name} — ${loan.loanCode}`,
        documentType: template.code,
        loanId: loan.id,
        loanCode: loan.loanCode,
        borrowerName: loan.borrowerName,
        generatedBy: loan.loanOfficerName,
        generatedAt: loan.activatedAt,
      });
    }
    docs.push({
      id: `doc-${loan.id}-as`,
      documentName: `Amortization Schedule — ${loan.loanCode}`,
      documentType: 'AS',
      loanId: loan.id,
      loanCode: loan.loanCode,
      borrowerName: loan.borrowerName,
      generatedBy: loan.loanOfficerName,
      generatedAt: loan.activatedAt,
    });
  }
  return docs;
}

export const MOCK_GENERATED_DOCUMENTS = buildGeneratedDocuments();

/** The generated loan documents for one loan account — used by `LoanDetailPage`'s Attachments tab. */
export function getGeneratedDocumentsForLoan(loanId: string): MockGeneratedDocument[] {
  return MOCK_GENERATED_DOCUMENTS.filter((d) => d.loanId === loanId);
}

MOCK_BORROWERS.push(
  {
    id: 'borrower-repeat-stephanie-salazar-antoy',
    name: 'Stephanie Salazar Antoy',
    profilePictureUrl: '/applicants/applicant-5.jpg',
    contactNumber: '09171234501',
    email: 'stephanie.salazar.antoy@sample-mail.example',
    address: 'Brgy. Highway Hills, Mandaluyong',
    employer: 'BDO Unibank',
    position: 'Rank & File',
    monthlyIncome: 42000,
    civilStatus: 'Married',
    dateOfBirth: new Date(Date.UTC(1974, 0, 1)).toISOString(),
    homeBranchName: COMPANY_INFO.branchName,
    loanIds: [REPEAT_CLIENT_LOAN_1.loan.id],
    attachments: buildClientAttachments('borrower-repeat-stephanie-salazar-antoy'),
  },
  {
    id: 'borrower-repeat-mary-grace-gallardo',
    name: 'Mary Grace Dalapo Gallardo',
    profilePictureUrl: '/applicants/applicant-6.jpg',
    contactNumber: '09171234502',
    email: 'mary.grace.dalapo.gallardo@sample-mail.example',
    address: 'Brgy. Ususan, Taguig',
    employer: 'Self-employed — sari-sari store & rice retailing',
    position: 'Owner/Proprietor',
    monthlyIncome: 45000,
    civilStatus: 'Single',
    dateOfBirth: new Date(Date.UTC(1988, 0, 1)).toISOString(),
    homeBranchName: COMPANY_INFO.branchName,
    loanIds: [REPEAT_CLIENT_LOAN_2.loan.id],
    attachments: buildClientAttachments('borrower-repeat-mary-grace-gallardo'),
  },
);

/** Name-match lookup used by the Loan Application detail page's "Repeat Client" indicator. Real production code would key this off a stable client ID, not name string-matching — acceptable simplification for this mock-data preview. */
export function findRepeatClientBorrower(applicantName: string): MockBorrowerProfile | undefined {
  return MOCK_BORROWERS.find((b) => b.name === applicantName);
}

// ---------------------------------------------------------------------------
// Transactions — mirrors `LoanTransaction` (`app/backend/src/modules/ledger/
// domain/LoanTransaction.ts`): one DISBURSEMENT per activated loan, one
// REPAYMENT per installment with a nonzero paid amount, plus a PENALTY_APPLIED
// entry for in-arrears loans. Derived entirely from MOCK_LOANS/MOCK_INSTALLMENTS
// above, not independently randomized, so the two screens stay consistent.
// ---------------------------------------------------------------------------

export type LoanTransactionType =
  | 'DISBURSEMENT'
  | 'REPAYMENT'
  | 'FEE_CHARGED'
  | 'PENALTY_APPLIED'
  | 'INTEREST_APPLIED'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export interface MockLoanTransaction {
  id: string;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  type: LoanTransactionType;
  amount: number;
  components: { principal: number; interest: number; fees: number; penalty: number };
  entryDate: string;
  postedByUserId: string;
  /** Only set for REPAYMENT transactions — code into `MOCK_PAYMENT_METHODS`. */
  paymentMethod?: string;
}

/**
 * A loan's `paymentMethod` reflects its CURRENT/preferred channel — but a
 * few closed loans' EARLIEST payment demonstrably used a since-discontinued
 * channel before the borrower (or the company) moved to an active one. This
 * is exactly the "still visible as historical reference" requirement — not
 * every past transaction needs to match the loan's current method.
 */
const HISTORICAL_DISCONTINUED_PAYMENT_OVERRIDE: Record<string, string> = {
  'loan-11': 'DRAGONPAY',
  'loan-12': 'ECPAY',
};

function buildTransactions(): MockLoanTransaction[] {
  const transactions: MockLoanTransaction[] = [];

  for (const loan of MOCK_LOANS) {
    if (loan.activatedAt) {
      transactions.push({
        id: `${loan.id}-txn-disb`,
        loanAccountId: loan.id,
        loanCode: loan.loanCode,
        borrowerName: loan.borrowerName,
        branchId: loan.branchId,
        branchName: loan.branchName,
        type: 'DISBURSEMENT',
        amount: loan.principalAmount,
        components: { principal: loan.principalAmount, interest: 0, fees: 0, penalty: 0 },
        entryDate: loan.activatedAt,
        postedByUserId: loan.loanOfficerName,
      });
    }

    const loanInstallments = MOCK_INSTALLMENTS[loan.id] ?? [];
    let firstRepaymentSeen = false;
    for (const installment of loanInstallments) {
      const paidTotal = installment.paid.principal + installment.paid.interest + installment.paid.fees + installment.paid.penalty;
      if (paidTotal > 0) {
        const isFirstRepayment = !firstRepaymentSeen;
        firstRepaymentSeen = true;
        const discontinuedOverride = isFirstRepayment ? HISTORICAL_DISCONTINUED_PAYMENT_OVERRIDE[loan.id] : undefined;

        transactions.push({
          id: `${installment.id}-txn-repay`,
          loanAccountId: loan.id,
          loanCode: loan.loanCode,
          borrowerName: loan.borrowerName,
          branchId: loan.branchId,
          branchName: loan.branchName,
          type: 'REPAYMENT',
          amount: round2(paidTotal),
          components: { ...installment.paid },
          entryDate: installment.dueDate,
          postedByUserId: loan.loanOfficerName,
          paymentMethod: discontinuedOverride ?? loan.paymentMethod,
        });
      }
    }

    if (loan.balances.penaltyBalance > 0) {
      transactions.push({
        id: `${loan.id}-txn-penalty`,
        loanAccountId: loan.id,
        loanCode: loan.loanCode,
        borrowerName: loan.borrowerName,
        branchId: loan.branchId,
        branchName: loan.branchName,
        type: 'PENALTY_APPLIED',
        amount: loan.balances.penaltyBalance,
        components: { principal: 0, interest: 0, fees: 0, penalty: loan.balances.penaltyBalance },
        entryDate: new Date().toISOString(),
        postedByUserId: 'System',
      });
    }
  }

  return transactions.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
}

export const MOCK_TRANSACTIONS: MockLoanTransaction[] = buildTransactions();

// ---------------------------------------------------------------------------
// Reports — Daily / Monthly / Yearly loan-origination and collections
// aggregates. Precomputed once here (not re-randomized on every render) so
// the Reports screens' date-range/branch filters do real client-side
// filtering over a fixed dataset, per this checkpoint's interactivity
// requirement.
// ---------------------------------------------------------------------------

export interface DailyReportRow {
  date: string;
  branchId: string;
  branchName: string;
  loansOriginated: number;
  amountOriginated: number;
  amountCollected: number;
  collectionTarget: number;
}

function buildDailyReportRows(days: number): DailyReportRow[] {
  const rows: DailyReportRow[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86_400_000);
    for (const branch of BRANCHES) {
      const loansOriginated = Math.floor(rng() * 4);
      rows.push({
        date: date.toISOString(),
        branchId: branch.id,
        branchName: branch.name,
        loansOriginated,
        amountOriginated: round2(loansOriginated * (15000 + rng() * 60000)),
        amountCollected: round2(20000 + rng() * 60000),
        collectionTarget: round2(35000 + rng() * 20000),
      });
    }
  }
  return rows;
}

/** Last 45 days, all branches — the Daily tab's date-range picker filters this fixed array client-side. */
export const DAILY_REPORT_ROWS: DailyReportRow[] = buildDailyReportRows(45);

export interface PeriodReportRow {
  label: string;
  branchId: string;
  branchName: string;
  loansOriginated: number;
  amountOriginated: number;
  amountCollected: number;
  collectionTarget: number;
}

function buildMonthlyReportRows(): PeriodReportRow[] {
  const rows: PeriodReportRow[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = addMonths(now, -i);
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    for (const branch of BRANCHES) {
      const loansOriginated = 8 + Math.floor(rng() * 20);
      rows.push({
        label,
        branchId: branch.id,
        branchName: branch.name,
        loansOriginated,
        amountOriginated: round2(loansOriginated * (18000 + rng() * 50000)),
        amountCollected: round2(600000 + rng() * 400000),
        collectionTarget: round2(750000 + rng() * 150000),
      });
    }
  }
  return rows;
}

export const MONTHLY_REPORT_ROWS: PeriodReportRow[] = buildMonthlyReportRows();

function buildYearlyReportRows(): PeriodReportRow[] {
  const rows: PeriodReportRow[] = [];
  const currentYear = new Date().getUTCFullYear();
  for (let i = 3; i >= 0; i--) {
    const label = String(currentYear - i);
    for (const branch of BRANCHES) {
      const loansOriginated = 120 + Math.floor(rng() * 200);
      rows.push({
        label,
        branchId: branch.id,
        branchName: branch.name,
        loansOriginated,
        amountOriginated: round2(loansOriginated * (20000 + rng() * 45000)),
        amountCollected: round2(8_000_000 + rng() * 4_000_000),
        collectionTarget: round2(9_500_000 + rng() * 1_500_000),
      });
    }
  }
  return rows;
}

export const YEARLY_REPORT_ROWS: PeriodReportRow[] = buildYearlyReportRows();

export const REPORT_BRANCHES = BRANCHES;
export const REPORT_TRANSACTION_TYPES: LoanTransactionType[] = [
  'DISBURSEMENT',
  'REPAYMENT',
  'FEE_CHARGED',
  'PENALTY_APPLIED',
  'INTEREST_APPLIED',
  'ADJUSTMENT',
  'REVERSAL',
];

// ---------------------------------------------------------------------------
// LMS Administration — staff/user accounts and activity logs.
//
// Access policy previewed here (confirmed business detail, not an
// assumption):
//   - MIS            = super user, all access (including add/edit LMS
//                       members, and the only role that may revert a
//                       decided Loan Application back to Pending Review —
//                       the "undo an accidental click" safety net).
//   - Loan Operation Manager, CRM = same base access as the non-admin roles
//                       below, PLUS the special right to view/assign/approve/
//                       decline Loan Applications. Neither can revert a
//                       decision once made — only MIS can.
//   - Finance, Accounting, Collection Officer = share one base ("non-admin")
//                       access tier — cannot manage LMS members, cannot
//                       access Loan Applications.
//   - Activity Logs (full details) are visible only to MIS and Loan
//                       Operation Manager.
// `src/lib/roleContext.tsx`'s mock account switcher lets the CEO see this
// restriction applied live in the UI — it is NOT real authentication/
// authorization, just a UI-level preview of the intended access-control rule.
// ---------------------------------------------------------------------------

export type LmsRole = 'MIS' | 'Loan Operation Manager' | 'CRM' | 'Finance' | 'Accounting' | 'Collection Officer';
export type LmsMemberStatus = 'ACTIVE' | 'DISABLED';

export interface MockLmsMember {
  id: string;
  name: string;
  role: LmsRole;
  branchName: string;
  email: string;
  status: LmsMemberStatus;
  lastLoginAt: string | null;
}

export const MOCK_LMS_MEMBERS: MockLmsMember[] = [
  { id: 'member-1', name: 'Jomer A. Biason', role: 'MIS', branchName: COMPANY_INFO.branchName, email: 'jomer.biason@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 1 * 3_600_000).toISOString() },
  { id: 'member-2', name: 'Nomer D. Perez', role: 'MIS', branchName: COMPANY_INFO.branchName, email: 'nomer.perez@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 3 * 3_600_000).toISOString() },
  { id: 'member-3', name: 'Liezel Pentecostes', role: 'Loan Operation Manager', branchName: COMPANY_INFO.branchName, email: 'liezel.pentecostes@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
  { id: 'member-7', name: 'Rosemarie Tenchavez', role: 'CRM', branchName: COMPANY_INFO.branchName, email: 'rosemarie.tenchavez@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 90 * 60_000).toISOString() },
  { id: 'member-4', name: 'Mariel Deguzman', role: 'Finance', branchName: COMPANY_INFO.branchName, email: 'mariel.deguzman@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
  { id: 'member-5', name: 'Kyla Sobel', role: 'Accounting', branchName: COMPANY_INFO.branchName, email: 'kyla.sobel@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
  { id: 'member-6', name: 'Rosan Cinco', role: 'Collection Officer', branchName: COMPANY_INFO.branchName, email: 'rosan.cinco@easycash.ph', status: 'ACTIVE', lastLoginAt: new Date(Date.now() - 4 * 3_600_000).toISOString() },
];

export function emptyDraftMember(): MockLmsMember {
  return {
    id: `member-draft-${Date.now()}`,
    name: '',
    role: 'Collection Officer',
    branchName: COMPANY_INFO.branchName,
    email: '',
    status: 'ACTIVE',
    lastLoginAt: null,
  };
}

export interface MockActivityLogEntry {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  at: string;
}

function buildActivityLog(): MockActivityLogEntry[] {
  const entries: MockActivityLogEntry[] = [];
  for (const member of MOCK_LMS_MEMBERS) {
    if (member.lastLoginAt) {
      entries.push({
        id: `log-login-${member.id}`,
        userName: member.name,
        action: 'LOGIN',
        entityType: 'User',
        entityId: member.id,
        at: member.lastLoginAt,
      });
    }
  }
  for (const loan of MOCK_LOANS.slice(0, 12)) {
    entries.push({
      id: `log-approve-${loan.id}`,
      userName: loan.loanOfficerName,
      action: loan.status === 'PENDING_APPROVAL' ? 'SUBMIT_LOAN_APPLICATION' : 'APPROVE_LOAN',
      entityType: 'LoanAccount',
      entityId: loan.loanCode,
      at: loan.approvedAt ?? loan.createdAt,
    });
    if (loan.activatedAt) {
      entries.push({
        id: `log-activate-${loan.id}`,
        userName: loan.loanOfficerName,
        action: 'ACTIVATE_LOAN',
        entityType: 'LoanAccount',
        entityId: loan.loanCode,
        at: loan.activatedAt,
      });
    }
  }
  for (const txn of MOCK_TRANSACTIONS.slice(0, 15)) {
    if (txn.type === 'REPAYMENT') {
      entries.push({
        id: `log-payment-${txn.id}`,
        userName: txn.postedByUserId,
        action: 'RECORD_PAYMENT',
        entityType: 'LoanAccount',
        entityId: txn.loanCode,
        at: txn.entryDate,
      });
    }
  }
  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** Static/mock only — illustrates what a real audit trail would record (user, action, timestamp, affected entity). */
export const MOCK_ACTIVITY_LOGS: MockActivityLogEntry[] = buildActivityLog();

// ---------------------------------------------------------------------------
// AI-Assisted Risk Assessment — mock only, no real AI/ML call. Deliberately
// deterministic (derived from each loan's own status/payment progress, not
// randomized) so the same loan always shows the same assessment. Always
// paired with the disclosure that the Loan Officer makes the final call —
// this preview must never imply an autonomous decision-making system.
// ---------------------------------------------------------------------------

export type MockRiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk';

export interface MockRiskAssessment {
  level: MockRiskLevel;
  explanation: string;
}

const RISK_EXPLANATIONS: Record<MockRiskLevel, string> = {
  'Low Risk':
    'Batay sa employment history at credit background, ang applicant na ito ay may matatag na income source at walang naitalang overdue payment. Mababa ang pagkakataon ng default batay sa sample data na ito.',
  'Medium Risk':
    'May ilang late o partial payment na naitala sa nakaraang buwan, ngunit steady pa rin ang income source ng borrower. Katamtaman ang antas ng panganib — inirerekomenda ang regular na follow-up.',
  'High Risk':
    'Ang account ay may patuloy na overdue balance at ilang nalagpasang due date. Mataas ang pagkakataon ng default batay sa kasalukuyang sample data — maaaring kailanganin ng agarang aksyon mula sa collections team.',
};

function buildRiskAssessment(loan: MockLoanAccount): MockRiskAssessment {
  let level: MockRiskLevel;
  if (loan.status === 'ACTIVE_IN_ARREARS' || loan.status === 'MATURED' || loan.status === 'CLOSED_WRITTEN_OFF') {
    level = 'High Risk';
  } else if (loan.status === 'CLOSED') {
    level = 'Low Risk';
  } else if (loan.status === 'ACTIVE') {
    const paidFraction = loan.balances.principalDue > 0 ? loan.balances.principalPaid / loan.balances.principalDue : 0;
    level = paidFraction >= 0.4 ? 'Low Risk' : 'Medium Risk';
  } else {
    // PENDING_APPROVAL / APPROVED — no repayment history yet, assessed from application data only.
    level = 'Medium Risk';
  }
  return { level, explanation: RISK_EXPLANATIONS[level] };
}

export const MOCK_RISK_ASSESSMENTS: Record<string, MockRiskAssessment> = Object.fromEntries(
  MOCK_LOANS.map((loan) => [loan.id, buildRiskAssessment(loan)]),
);

export function getMockRiskAssessment(loanId: string): MockRiskAssessment | undefined {
  return MOCK_RISK_ASSESSMENTS[loanId];
}

export const REPORT_PAYMENT_METHODS = MOCK_PAYMENT_METHODS;

// ---------------------------------------------------------------------------
// Loan Application Intake — mock only. Represents applications that would
// arrive via API from the future public Easycash loan-application website
// (not yet built — see PROJECT_HANDOFF.md; this section previews the LMS
// side of that intake only).
//
// Applicant identities and profile photos below are REAL — sourced, per
// explicit instruction, from real historical applicant folders under
// `legacy/sdevtech/` (each folder is one applicant's actual submitted case
// file). Only the financial figures, dates, AI risk output, and decision
// outcomes are FABRICATED for this preview, same treatment as
// `MOCK_BORROWERS` below. Profile photos are the applicant's own submitted
// selfie/ID photo, copied into `public/applicants/`.
//
// Attachment ENTRIES are deliberately limited to documents an APPLICANT
// would actually submit at intake — photo, valid IDs (Borrower and
// Co-Borrower), Employee ID, Corporate Payslip, Latest Proof of Billing,
// Driver's License, Passport, KYC/credit bureau reports, and (Seafarer
// applicants only) seaman's book / OEC. Confirmed per this checkpoint:
// documents that only exist for an already-APPROVED official loan account
// (Promissory Note, Deed of Assignment, Disclosure Statement, Loan
// Agreement, Special Power of Attorney, Data Privacy and Consent Form,
// Manulife insurance, etc.) never appear here — those belong on the Loan
// Account itself (see `LoanDetailPage`'s Attachments tab), not the
// application. File names shown are illustrative, not bundled/servable —
// only name/size/type is shown, "Download" stays disabled/Coming Soon, so
// no actual document content is ever exposed by this preview.
//
// The "AI Risk Assessment" on each application is a static, hand-authored
// mock — no real AI/ML model runs here, and no real underwriting formula is
// implied. It qualifies/flags against the exact factors given for this
// checkpoint (age 18–55, address, monthly income, properties, credit score)
// and always produces a *recommendation*, never a decision — approval/
// decline is a human action taken by MIS, the Loan Operation Manager, or
// CRM (see `canAccessLoanApplications` in `roleContext.tsx`). CRM and Loan
// Operation Manager can approve/decline but can never revert a decision
// once made — only MIS (super user) can revert a decided application back
// to Pending Review, as the safety net for an accidental click.
//
// Approving an application does NOT automatically create an official
// LoanAccount — per this checkpoint's own clarification, an approved
// client may not yet have an official loan account (that's a separate,
// later step, reflected as a "Coming Soon" action in the detail page).
//
// The client only selects a general category when applying (e.g. "Salary
// Loan") — the specific sub-type/product code (`SL-Reg` vs `SL-Corp` vs
// `SL-Spec`) is assigned afterward by staff during review, not by the
// client, so `assignedSubType` starts unset (`undefined`) for every
// still-pending application below.
//
// `reviewState` is a SEPARATE, email-inbox-style read/unread flag — whether
// staff has opened/looked at this application yet — independent of the
// approve/decline decision captured in `status`. Opening the detail page
// auto-marks it "Reviewed"; the list page supports bulk toggling back and
// forth (like Gmail's "mark as read/unread").
//
// Co-borrower is optional — most sample applications have none.
// ---------------------------------------------------------------------------

export type LoanApplicationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'DECLINED';
export type LoanApplicationReviewState = 'UNREVIEWED' | 'REVIEWED';

export interface MockQualificationFactor {
  label: string;
  value: string;
  passed: boolean;
}

/** A file record only — file name/size/type shown, never the actual file content (Download stays Coming Soon everywhere this is used). */
export interface MockUploadedFile {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
}

export interface MockLoanApplication {
  id: string;
  applicantName: string;
  /** Path under `public/` — the applicant's own submitted selfie/ID photo (real, per `legacy/sdevtech/`). */
  profilePictureUrl?: string;
  age: number;
  address: string;
  monthlyIncome: number;
  employer: string;
  propertiesOwned: string[];
  creditScore: number;
  coBorrowerName?: string;
  /**
   * Set only for applications encoded at the branch by a loan officer (walk-in applicant filling
   * out the paper form ECLC-LOFN01) — the officer's name. Absent on applications that "arrived"
   * via the future public website intake.
   */
  encodedBy?: string;
  /** Paper form §1 — "How did you find out about Easycash?" (officer-encoded applications only). */
  referralSource?: string;
  /** Paper form §2 — Type of Account. */
  accountType?: 'NEW' | 'RENEWAL';
  /** Paper form §2 — "What is your loan purpose?" */
  loanPurpose?: string;
  requestedCategory: string;
  /** Set by staff during review — never by the client. Undefined until an assigned Loan Officer/Manager picks the sub-type. */
  assignedSubType?: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedAt: string;
  status: LoanApplicationStatus;
  /** Email-inbox-style "seen" flag — independent of `status`. */
  reviewState: LoanApplicationReviewState;
  aiRisk: MockRiskLevel;
  aiRecommendation: string;
  aiFactors: MockQualificationFactor[];
  attachments: MockUploadedFile[];
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNote?: string;
  /** Set once "Create Client" has been used on this (Approved) application — prevents creating a duplicate client record. */
  clientCreated?: boolean;
  createdClientId?: string;
  /** Set once "Create Loan Account" has been used on this application (after Create Client) — an application converts to at most one loan account. */
  loanAccountCreated?: boolean;
  createdLoanAccountId?: string;
}

/** Application-stage document names only (see section comment above) with fabricated size/upload date — metadata only, never actual file content. */
function buildApplicationAttachments(id: string, fileNames: string[], submittedAt: string): MockUploadedFile[] {
  const submitted = new Date(submittedAt);
  return fileNames.map((fileName, i) => ({
    id: `${id}-att-${i}`,
    fileName,
    sizeKb: Math.round(80 + rng() * 2400),
    uploadedAt: new Date(submitted.getTime() - (fileNames.length - i) * 3_600_000).toISOString(),
  }));
}

/**
 * Standard intake-stage documents a walk-in applicant can submit with the paper form
 * (ECLC-LOFN01) — the checklist shown on the officer-encoded Create Application form. Matches
 * the same intake-only document set used by the sample applications above (never
 * approved-loan-stage documents like the Promissory Note — those only exist on a Loan Account).
 */
export const INTAKE_DOCUMENT_OPTIONS: string[] = [
  'Selfie Photo.jpg',
  '2x2 ID Picture.jpg',
  'Valid ID (Borrower).jpg',
  'Valid ID (Co-Borrower).jpg',
  'Employee ID.jpg',
  'Corporate Payslip.pdf',
  'Latest Proof of Billing.jpg',
  "Driver's License.jpg",
  'Passport.jpg',
  "Seaman's Book.jpg",
  'Overseas Employment Certificate (OEC).pdf',
  'CB Credit Bureau Report.pdf',
];

export interface CreateLoanApplicationInput {
  applicantName: string;
  age: number;
  address: string;
  monthlyIncome: number;
  employer: string;
  propertiesOwned: string[];
  creditScore: number;
  coBorrowerName?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  referralSource?: string;
  accountType?: 'NEW' | 'RENEWAL';
  loanPurpose?: string;
  submittedDocuments: string[];
  /** The loan officer encoding this walk-in application (paper form ECLC-LOFN01). */
  encodedBy: string;
}

/**
 * Officer-encoded application intake (Create Application form): builds the same qualification
 * factors / risk level the sample applications carry (age 18–55, verifiable address, income vs.
 * amortization, credit score ≥ 600, properties on record), prepends the new application to
 * `MOCK_LOAN_APPLICATIONS` (newest first), and returns it. In-memory only, same as every other
 * mutation in this preview build — the AI summary is a rule-based mock, not a real engine, per
 * the disclosure already shown on the application detail page.
 */
export function createLoanApplication(input: CreateLoanApplicationInput): MockLoanApplication {
  const id = `application-${MOCK_LOAN_APPLICATIONS.length + 1}-${Date.now().toString(36)}`;
  const submittedAt = new Date().toISOString();
  const estimatedMonthlyAmortization = input.requestedTermMonths > 0 ? input.requestedAmount / input.requestedTermMonths : Infinity;

  const agePassed = input.age >= 18 && input.age <= 55;
  const addressPassed = input.address.trim().length > 0;
  const incomePassed = input.monthlyIncome >= estimatedMonthlyAmortization * 2;
  const creditPassed = input.creditScore >= 600;
  const aiFactors: MockQualificationFactor[] = [
    { label: 'Age (18–55)', value: `${input.age} years old`, passed: agePassed },
    {
      label: 'Verifiable Address',
      value: addressPassed ? 'Provided — verify against valid ID' : 'Missing',
      passed: addressPassed,
    },
    {
      label: 'Monthly Income vs. Requested Term',
      value: `${formatPeso(input.monthlyIncome)}/mo vs. ~${formatPeso(Math.round(estimatedMonthlyAmortization))}/mo amortization`,
      passed: incomePassed,
    },
    { label: 'Credit Score (≥ 600)', value: String(input.creditScore), passed: creditPassed },
    {
      label: 'Properties Owned',
      value: input.propertiesOwned.length > 0 ? input.propertiesOwned.join('; ') : 'None on record',
      passed: true,
    },
  ];
  const failedCount = aiFactors.filter((f) => !f.passed).length;
  const aiRisk: MockRiskLevel = failedCount === 0 ? 'Low Risk' : failedCount === 1 ? 'Medium Risk' : 'High Risk';
  const aiRecommendation =
    failedCount === 0
      ? 'Qualified — all factors within acceptable range. Recommended for approval.'
      : failedCount === 1
        ? 'One qualification factor is outside the acceptable range — recommended for manual review before a decision.'
        : 'Multiple qualification factors are outside the acceptable range — recommended for decline pending manual review.';

  const application: MockLoanApplication = {
    id,
    applicantName: input.applicantName,
    age: input.age,
    address: input.address,
    monthlyIncome: input.monthlyIncome,
    employer: input.employer,
    propertiesOwned: input.propertiesOwned,
    creditScore: input.creditScore,
    coBorrowerName: input.coBorrowerName,
    encodedBy: input.encodedBy,
    referralSource: input.referralSource,
    accountType: input.accountType,
    loanPurpose: input.loanPurpose,
    requestedCategory: input.requestedCategory,
    requestedAmount: input.requestedAmount,
    requestedTermMonths: input.requestedTermMonths,
    submittedAt,
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk,
    aiRecommendation,
    aiFactors,
    attachments: buildApplicationAttachments(id, input.submittedDocuments, submittedAt),
  };
  MOCK_LOAN_APPLICATIONS.unshift(application);
  return application;
}

export const MOCK_LOAN_APPLICATIONS: MockLoanApplication[] = [
  {
    id: 'application-1',
    applicantName: 'Jennelyn Corsiga Custodio',
    profilePictureUrl: '/applicants/applicant-1.jpg',
    age: 29,
    address: 'Brgy. Holy Spirit, Quezon City',
    monthlyIncome: 35000,
    employer: 'ABC Retail Corp.',
    propertiesOwned: [],
    creditScore: 720,
    requestedCategory: 'Salary Loan',
    requestedAmount: 80000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'Low Risk',
    aiRecommendation: 'Qualified — all factors within acceptable range. Recommended for approval.',
    aiFactors: [
      { label: 'Age (18–55)', value: '29 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱35,000/mo — sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '720', passed: true },
      { label: 'Properties Owned', value: 'None on record', passed: true },
    ],
    attachments: buildApplicationAttachments(
      'application-1',
      ['2x2 ID Picture.jpg', 'Employee ID.jpg', 'Valid ID (Borrower).jpg', 'Latest Proof of Billing.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 1 * 86_400_000).toISOString(),
    ),
  },
  {
    id: 'application-2',
    applicantName: 'Marvin Cruz Salvatierra',
    profilePictureUrl: '/applicants/applicant-2.jpg',
    age: 27,
    address: 'Brgy. San Antonio, Manila',
    monthlyIncome: 32000,
    employer: 'San Miguel Corp. (Easycash tied-up partner)',
    propertiesOwned: [],
    creditScore: 690,
    coBorrowerName: 'Angelica Salvatierra (spouse)',
    requestedCategory: 'Salary Loan',
    requestedAmount: 60000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'Low Risk',
    aiRecommendation: 'Qualified — employer is a tied-up agency partner, reducing verification risk. Recommended for approval.',
    aiFactors: [
      { label: 'Age (18–55)', value: '27 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱32,000/mo — sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '690', passed: true },
      { label: 'Properties Owned', value: 'None on record', passed: true },
    ],
    attachments: buildApplicationAttachments(
      'application-2',
      ['Selfie Photo.jpg', 'Employee ID.jpg', 'Corporate Payslip.pdf', 'Valid ID (Borrower).jpg', 'Valid ID (Co-Borrower).jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ),
  },
  {
    id: 'application-3',
    applicantName: 'Kennenth Lagutas Baliuag',
    profilePictureUrl: '/applicants/applicant-3.jpg',
    age: 34,
    address: 'Brgy. Malate, Manila',
    monthlyIncome: 80000,
    employer: 'Overseas — Maritime Vessel (allotment)',
    propertiesOwned: ['Condominium unit — Pasay City'],
    creditScore: 700,
    requestedCategory: 'Seafarer Loan',
    assignedSubType: 'SML-REGULAR',
    requestedAmount: 250000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    status: 'APPROVED',
    reviewState: 'REVIEWED',
    aiRisk: 'Low Risk',
    aiRecommendation: 'Qualified — strong income and property ownership. Recommended for approval.',
    aiFactors: [
      { label: 'Age (18–55)', value: '34 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱80,000/mo (allotment) — sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '700', passed: true },
      { label: 'Properties Owned', value: '1 condominium unit', passed: true },
    ],
    attachments: buildApplicationAttachments(
      'application-3',
      ["Selfie Photo.jpg", "Seaman's Book.jpg", 'Overseas Employment Certificate (OEC).pdf', 'Valid ID (Borrower).jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 9 * 86_400_000).toISOString(),
    ),
    reviewedBy: 'Jomer A. Biason',
    reviewedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    decisionNote: 'Approved as-is — strong profile, no conditions.',
  },
  {
    id: 'application-4',
    applicantName: 'Jackilyn Borromeo Notado',
    profilePictureUrl: '/applicants/applicant-4.jpg',
    age: 23,
    address: 'Brgy. Bagong Ilog, Pasig',
    monthlyIncome: 18000,
    employer: 'Freelance / no fixed employer',
    propertiesOwned: [],
    creditScore: 560,
    requestedCategory: 'Salary Loan',
    assignedSubType: 'SL-REGULAR',
    requestedAmount: 100000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    status: 'DECLINED',
    reviewState: 'REVIEWED',
    aiRisk: 'High Risk',
    aiRecommendation: 'Does not meet minimum qualification criteria — income insufficient for requested amount and credit score below threshold. Recommended for decline.',
    aiFactors: [
      { label: 'Age (18–55)', value: '23 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱18,000/mo — insufficient for ₱100,000 requested', passed: false },
      { label: 'Credit Score (≥ 600)', value: '560', passed: false },
      { label: 'Properties Owned', value: 'None on record', passed: false },
    ],
    attachments: buildApplicationAttachments(
      'application-4',
      ['Selfie Photo.jpg', 'Valid ID (Borrower).jpg', 'Latest Proof of Billing.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 5 * 86_400_000).toISOString(),
    ),
    reviewedBy: 'Liezel Pentecostes',
    reviewedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    decisionNote: 'Declined per AI recommendation — income and credit score both below threshold; no property to offset risk.',
  },
  {
    id: 'application-5',
    applicantName: 'Stephanie Salazar Antoy',
    profilePictureUrl: '/applicants/applicant-5.jpg',
    age: 52,
    address: 'Brgy. Highway Hills, Mandaluyong',
    monthlyIncome: 42000,
    employer: 'BDO Unibank',
    propertiesOwned: ['Residential lot — Antipolo City'],
    creditScore: 745,
    coBorrowerName: 'Ferdinand Antoy (spouse)',
    requestedCategory: 'Salary Loan',
    requestedAmount: 150000,
    requestedTermMonths: 18,
    submittedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'Low Risk',
    aiRecommendation:
      'Qualified — all factors within acceptable range, and repeat-client history supports approval: her previous Easycash loan (SL-Reg_0900) was paid in full with no late installments, indicating a good payer. Recommended for approval.',
    aiFactors: [
      { label: 'Age (18–55)', value: '52 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱42,000/mo — sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '745', passed: true },
      { label: 'Properties Owned', value: '1 residential lot', passed: true },
    ],
    attachments: buildApplicationAttachments(
      'application-5',
      ['Selfie Photo.jpg', 'Employee ID.jpg', 'Valid ID (Borrower).jpg', 'Valid ID (Co-Borrower).jpg', 'Latest Proof of Billing.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 1 * 86_400_000).toISOString(),
    ),
  },
  {
    id: 'application-6',
    applicantName: 'Mary Grace Dalapo Gallardo',
    profilePictureUrl: '/applicants/applicant-6.jpg',
    age: 38,
    address: 'Brgy. Ususan, Taguig',
    monthlyIncome: 45000,
    employer: 'Self-employed — sari-sari store & rice retailing',
    propertiesOwned: [],
    creditScore: 610,
    requestedCategory: 'Business Loan',
    requestedAmount: 300000,
    requestedTermMonths: 24,
    submittedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'High Risk',
    aiRecommendation:
      'Does not meet minimum qualification criteria — self-employed income is harder to verify and credit score is near the minimum threshold. Repeat-client history further weighs against approval: her previous Easycash loan (BL-Reg_0900) was written off delinquent, paid on-time for only 7 of 18 installments before falling behind; reported reason on file was a business slowdown that disrupted her sari-sari store income. Recommended for decline pending manual review.',
    aiFactors: [
      { label: 'Age (18–55)', value: '38 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱45,000/mo (self-declared, unverified) — borderline for requested amount', passed: false },
      { label: 'Credit Score (≥ 600)', value: '610', passed: true },
      { label: 'Properties Owned', value: 'None on record', passed: false },
      { label: 'Repeat-Client Payment History', value: 'Previous loan written off delinquent (7 of 18 paid)', passed: false },
    ],
    attachments: buildApplicationAttachments(
      'application-6',
      ['Selfie Photo.jpg', 'Valid ID (Borrower).jpg', "Driver's License.jpg", 'Latest Proof of Billing.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 3 * 86_400_000).toISOString(),
    ),
  },
  {
    id: 'application-7',
    applicantName: 'Joena Flores Ceralvo',
    profilePictureUrl: '/applicants/applicant-7.jpg',
    age: 59,
    address: 'Brgy. Batasan Hills, Quezon City',
    monthlyIncome: 55000,
    employer: 'Overseas — Maritime Vessel (allotment)',
    propertiesOwned: [],
    creditScore: 580,
    requestedCategory: 'Seafarer Loan',
    requestedAmount: 180000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'High Risk',
    aiRecommendation: 'Does not meet minimum qualification criteria — applicant is above the 55-year age limit, and credit score is below the preferred threshold. Recommended for decline, pending manual review.',
    aiFactors: [
      { label: 'Age (18–55)', value: '59 years old — exceeds age limit', passed: false },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱55,000/mo (allotment) — sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '580', passed: false },
      { label: 'Properties Owned', value: 'None on record', passed: false },
    ],
    attachments: buildApplicationAttachments(
      'application-7',
      ["Selfie Photo.jpg", "Seaman's Book.jpg", 'Overseas Employment Certificate (OEC).pdf', 'Valid ID (Borrower).jpg', 'Passport.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ),
  },
  {
    id: 'application-8',
    applicantName: 'Maria Leslie Trinidad Torrente',
    profilePictureUrl: '/applicants/applicant-8.jpg',
    age: 31,
    address: 'Brgy. Poblacion, Makati',
    monthlyIncome: 28000,
    employer: 'Jollibee Foods Corp.',
    propertiesOwned: [],
    creditScore: 615,
    requestedCategory: 'Salary Loan',
    requestedAmount: 60000,
    requestedTermMonths: 12,
    submittedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    status: 'PENDING_REVIEW',
    reviewState: 'UNREVIEWED',
    aiRisk: 'Medium Risk',
    aiRecommendation: 'Borderline — income covers the requested amount tightly and credit score is just above minimum. Recommend standard verification before deciding.',
    aiFactors: [
      { label: 'Age (18–55)', value: '31 years old', passed: true },
      { label: 'Verifiable Address', value: 'Complete, matches valid ID', passed: true },
      { label: 'Monthly Income vs. Requested Term', value: '₱28,000/mo — tight but sufficient for requested amount', passed: true },
      { label: 'Credit Score (≥ 600)', value: '615', passed: true },
      { label: 'Properties Owned', value: 'None on record', passed: false },
    ],
    attachments: buildApplicationAttachments(
      'application-8',
      ['Selfie Photo.jpg', 'Employee ID.jpg', 'Valid ID (Borrower).jpg', 'Latest Proof of Billing.jpg', 'CB Credit Bureau Report.pdf'],
      new Date(Date.now() - 4 * 86_400_000).toISOString(),
    ),
  },
];

export function getMockLoanApplication(id: string): MockLoanApplication | undefined {
  return MOCK_LOAN_APPLICATIONS.find((a) => a.id === id);
}

/**
 * Generic activity-log append used everywhere in this preview (page views,
 * notes, uploads, decisions, member edits, etc.) — pushes one entry and
 * re-sorts so `MOCK_ACTIVITY_LOGS` always stays newest-first. Every
 * meaningful user action in the app is expected to call this, per this
 * checkpoint's "all user activity must be logged" instruction.
 */
export function logActivity(entry: Omit<MockActivityLogEntry, 'id'> & { id?: string }): void {
  MOCK_ACTIVITY_LOGS.push({ id: entry.id ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry });
  MOCK_ACTIVITY_LOGS.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/**
 * "Create Client" — converts an APPROVED Loan Application into an official
 * client record (`MockBorrowerProfile`), pulling profile picture, age/DOB,
 * personal/contact info, address, and uploaded attachments straight from
 * the application, per this checkpoint's instruction that Client Details
 * originates from the Loan Application. In-memory only: pushes onto
 * `MOCK_BORROWERS` and marks the application `clientCreated`. Safe to call
 * only once per application — callers must check `clientCreated` first.
 */
export function createClientFromApplication(application: MockLoanApplication, actorName: string): MockBorrowerProfile {
  const id = `borrower-app-${application.id}`;
  const approxBirthYear = new Date().getUTCFullYear() - application.age;
  const client: MockBorrowerProfile = {
    id,
    name: application.applicantName,
    profilePictureUrl: application.profilePictureUrl,
    contactNumber: `09${Math.floor(100000000 + rng() * 800000000)}`,
    email: `${application.applicantName
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()
      .replace(/\s+/g, '.')}@sample-mail.example`,
    address: application.address,
    employer: application.employer,
    position: 'Rank & File',
    monthlyIncome: application.monthlyIncome,
    civilStatus: application.coBorrowerName ? 'Married' : 'Single',
    dateOfBirth: new Date(Date.UTC(approxBirthYear, 0, 1)).toISOString(),
    homeBranchName: COMPANY_INFO.branchName,
    loanIds: [],
    attachments: application.attachments,
  };
  MOCK_BORROWERS.push(client);
  application.clientCreated = true;
  application.createdClientId = id;
  logActivity({
    userName: actorName,
    action: 'CREATE_CLIENT',
    entityType: 'Client',
    entityId: id,
    at: new Date().toISOString(),
  });
  return client;
}

/** Business rule: a client may never have 2 simultaneously ACTIVE/ACTIVE_IN_ARREARS loan accounts. */
export function clientHasActiveLoan(borrowerId: string): boolean {
  const client = MOCK_BORROWERS.find((b) => b.id === borrowerId);
  if (!client) return false;
  return MOCK_LOANS.some(
    (l) => client.loanIds.includes(l.id) && (l.status === 'ACTIVE' || l.status === 'ACTIVE_IN_ARREARS'),
  );
}

/**
 * "Create Loan Account" from a Client profile — creates a new PENDING_APPROVAL
 * loan account for that client (in-memory only). Blocked if the client
 * already has an ACTIVE/ACTIVE_IN_ARREARS loan (see `clientHasActiveLoan`).
 * No repayment schedule is generated yet — same convention as every other
 * PENDING_APPROVAL loan in this preview, which only gets one upon
 * activation (a separate, not-yet-built step).
 */
export function createLoanAccountForClient(
  client: MockBorrowerProfile,
  params: {
    productCode: string;
    principalAmount: number;
    installmentCount: number;
    /** Contractual monthly rate override — defaults to the product's `defaultInterestRate` when omitted. */
    interestRate?: number;
    /** Matches the legacy calculator's "Co-Borrower" field — optional. */
    coBorrowerName?: string;
    /** Matches the legacy calculator's "Anticipated Disbursement Date" field — first repayment is derived as one month after this date. Defaults to today. */
    anticipatedDisbursementDate?: string;
    /** Code into `MOCK_PAYMENT_METHODS` — defaults to `GCASH` when omitted. */
    paymentMethod?: string;
    /** Required (by the UI) only when `paymentMethod` is `BANK_TRANSFER` or `AUTO_DEBIT` — see `MockLoanAccount.disbursementBank`. */
    disbursementBank?: MockLoanAccount['disbursementBank'];
    /** The approved Loan Application this loan account is being created from — see `findApprovedApplicationForClient()`. Marks that application as converted so it can't be used again. */
    sourceApplicationId?: string;
  },
  actorName: string,
): MockLoanAccount {
  const product = MOCK_LOAN_PRODUCTS.find((p) => p.productCode === params.productCode);
  const prefix = LOAN_GENERATION_CATALOG.find((c) => c.product.productCode === params.productCode)?.codePrefix ?? 'LN';
  const loanCode = nextLoanCode(prefix);
  const id = `loan-client-${Date.now()}`;
  const branch = pick(BRANCHES);
  const disbursementDate = params.anticipatedDisbursementDate ? new Date(params.anticipatedDisbursementDate) : new Date();
  const loan: MockLoanAccount = {
    id,
    loanCode,
    borrowerName: client.name,
    branchId: branch.id,
    branchName: branch.name,
    loanOfficerName: actorName,
    productId: product?.id ?? '',
    productType: product?.productName ?? params.productCode,
    isDiscontinuedProduct: product ? !product.isActive : false,
    status: 'PENDING_APPROVAL',
    principalAmount: params.principalAmount,
    interestRate: params.interestRate ?? product?.defaultInterestRate ?? 0,
    installmentCount: params.installmentCount,
    firstRepaymentDate: addMonths(disbursementDate, 1).toISOString(),
    coBorrowerName: params.coBorrowerName?.trim() || undefined,
    disbursementBank: params.disbursementBank,
    sourceApplicationId: params.sourceApplicationId,
    balances: {
      principalBalance: 0,
      principalPaid: 0,
      principalDue: 0,
      interestBalance: 0,
      interestPaid: 0,
      interestDue: 0,
      feesBalance: 0,
      feesPaid: 0,
      feesDue: 0,
      penaltyBalance: 0,
      penaltyPaid: 0,
      penaltyDue: 0,
    },
    collectionsBalance: 0,
    accountingBalance: 0,
    approvedAt: null,
    activatedAt: null,
    closedAt: null,
    createdAt: new Date().toISOString(),
    paymentMethod: params.paymentMethod ?? 'GCASH',
  };
  MOCK_LOANS.push(loan);
  MOCK_INSTALLMENTS[loan.id] = [];
  MOCK_TIMELINES[loan.id] = [
    { status: 'PENDING_APPROVAL', label: 'Loan account created from Client profile', at: loan.createdAt, actor: actorName },
  ];
  client.loanIds.push(id);
  logActivity({
    userName: actorName,
    action: 'CREATE_LOAN_ACCOUNT',
    entityType: 'LoanAccount',
    entityId: loan.loanCode,
    at: loan.createdAt,
  });
  if (params.sourceApplicationId) {
    const sourceApplication = MOCK_LOAN_APPLICATIONS.find((a) => a.id === params.sourceApplicationId);
    if (sourceApplication) {
      sourceApplication.loanAccountCreated = true;
      sourceApplication.createdLoanAccountId = loan.id;
    }
  }
  return loan;
}

/**
 * Business rule: a client may only get a new loan account from a specific, still-unconverted
 * APPROVED loan application (matched via `createdClientId` — the application "Create Client" used
 * to produce this client record). A client with no approved application on file, or whose only
 * approved application already converted to a loan account, cannot have a new loan account
 * created — reflects that every loan (including a renewal) needs its own reviewed/approved
 * application, not just an existing client relationship.
 */
export function findApprovedApplicationForClient(borrowerId: string): MockLoanApplication | undefined {
  return MOCK_LOAN_APPLICATIONS.find((a) => a.status === 'APPROVED' && a.createdClientId === borrowerId && !a.loanAccountCreated);
}

// Seed activity log entries for every sample application — submission always,
// plus a decision entry for any application already reviewed above.
for (const app of MOCK_LOAN_APPLICATIONS) {
  logActivity({
    id: `log-application-submit-${app.id}`,
    userName: app.applicantName,
    action: 'SUBMIT_LOAN_APPLICATION',
    entityType: 'LoanApplication',
    entityId: app.id,
    at: app.submittedAt,
  });
  if (app.reviewedBy && app.reviewedAt) {
    logActivity({
      id: `log-application-decision-${app.id}`,
      userName: app.reviewedBy,
      action: app.status === 'APPROVED' ? 'APPROVE_LOAN_APPLICATION' : 'DECLINE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: app.id,
      at: app.reviewedAt,
    });
  }
}

// ---------------------------------------------------------------------------
// Automatic Payment Reminders — mock only. Represents the system-generated
// reminder schedule confirmed for this checkpoint: 5 days before due date,
// 3 days before, 1 day before, on the due date itself, and weekly while past
// due. Each reminder is sent via SMS and Email simultaneously (both real
// channels today); a 3rd channel — the client's own Easycash account
// dashboard — is listed but always "Coming Soon", since it depends on the
// public client portal website, a separate future project not yet built.
//
// No real SMS/email is ever sent in this preview. A reminder's "Sent" vs.
// "Scheduled" status below is purely a function of whether its trigger date
// has already passed relative to today — this demonstrates the send
// indicator requested for this checkpoint without a real notification
// service running anywhere.
//
// The generated message content includes exactly what was asked: Client
// Name, Loan Account Name/Code, Loan Amount, and payment-progress (how many
// installments paid vs. remaining) — a fuller transaction-report-style
// breakdown is explicitly deferred to when the client-facing website exists,
// per this checkpoint's own instruction. Penalty fees are included only when
// the installment is past due.
// ---------------------------------------------------------------------------

export type PaymentReminderType = 'FIVE_DAYS_BEFORE' | 'THREE_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'DUE_DATE' | 'PAST_DUE_WEEKLY';
export type PaymentReminderChannel = 'SMS' | 'EMAIL';

export const REMINDER_TYPE_LABELS: Record<PaymentReminderType, string> = {
  FIVE_DAYS_BEFORE: '5 Days Before Due',
  THREE_DAYS_BEFORE: '3 Days Before Due',
  ONE_DAY_BEFORE: '1 Day Before Due',
  DUE_DATE: 'Due Date',
  PAST_DUE_WEEKLY: 'Past Due (Weekly)',
};

export interface MockPaymentReminderChannelResult {
  channel: PaymentReminderChannel;
  sent: boolean;
  recipient: string;
}

export interface MockPaymentReminder {
  id: string;
  loanId: string;
  loanCode: string;
  borrowerName: string;
  installmentNumber: number;
  dueDate: string;
  reminderType: PaymentReminderType;
  triggerDate: string;
  status: 'SENT' | 'SCHEDULED';
  channels: MockPaymentReminderChannelResult[];
  installmentAmountDue: number;
  penaltyDue: number;
  installmentsPaidCount: number;
  installmentsTotalCount: number;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Only the loan's next unpaid installment gets a reminder set — matches real behavior (no point reminding about an already-paid term). */
function buildRemindersForLoan(loan: MockLoanAccount): MockPaymentReminder[] {
  if (loan.status !== 'ACTIVE' && loan.status !== 'ACTIVE_IN_ARREARS') return [];
  const installments = MOCK_INSTALLMENTS[loan.id] ?? [];
  const unpaid = installments.filter((i) => i.status !== 'PAID');
  if (unpaid.length === 0) return [];
  const now = new Date();
  // Prefer the soonest installment still due today-or-later (so its 5/3/1-day-before reminders can genuinely be "Scheduled");
  // fall back to the most recent unpaid installment if the whole remaining schedule is already in the past.
  const nextDue = unpaid.find((i) => new Date(i.dueDate) >= now) ?? unpaid[unpaid.length - 1]!;

  const borrower = MOCK_BORROWERS.find((b) => b.name === loan.borrowerName);
  const dueDate = new Date(nextDue.dueDate);
  const installmentsPaidCount = installments.filter((i) => i.status === 'PAID').length;
  const installmentAmountDue = round2(
    nextDue.due.principal + nextDue.due.interest + nextDue.due.fees - nextDue.paid.principal - nextDue.paid.interest - nextDue.paid.fees,
  );

  const triggers: { type: PaymentReminderType; date: Date }[] = [
    { type: 'FIVE_DAYS_BEFORE', date: addDays(dueDate, -5) },
    { type: 'THREE_DAYS_BEFORE', date: addDays(dueDate, -3) },
    { type: 'ONE_DAY_BEFORE', date: addDays(dueDate, -1) },
    { type: 'DUE_DATE', date: dueDate },
  ];
  if (nextDue.status === 'LATE') {
    for (let week = 1; week <= 3; week++) {
      const weekDate = addDays(dueDate, week * 7);
      if (weekDate <= now) triggers.push({ type: 'PAST_DUE_WEEKLY', date: weekDate });
    }
  }

  return triggers.map((trigger, idx) => {
    const sent = trigger.date <= now;
    return {
      id: `reminder-${loan.id}-${idx}`,
      loanId: loan.id,
      loanCode: loan.loanCode,
      borrowerName: loan.borrowerName,
      installmentNumber: nextDue.installmentNumber,
      dueDate: nextDue.dueDate,
      reminderType: trigger.type,
      triggerDate: trigger.date.toISOString(),
      status: sent ? 'SENT' : 'SCHEDULED',
      channels: [
        { channel: 'SMS', sent, recipient: borrower?.contactNumber ?? 'N/A' },
        { channel: 'EMAIL', sent, recipient: borrower?.email ?? 'N/A' },
      ],
      installmentAmountDue,
      penaltyDue: nextDue.status === 'LATE' ? loan.balances.penaltyBalance : 0,
      installmentsPaidCount,
      installmentsTotalCount: installments.length,
    };
  });
}

export const MOCK_PAYMENT_REMINDERS: MockPaymentReminder[] = MOCK_LOANS.flatMap(buildRemindersForLoan).sort(
  (a, b) => new Date(b.triggerDate).getTime() - new Date(a.triggerDate).getTime(),
);

export function getMockPaymentReminder(id: string): MockPaymentReminder | undefined {
  return MOCK_PAYMENT_REMINDERS.find((r) => r.id === id);
}

/** The exact system-generated message text (SMS/Email body) for a reminder — Client Name, Loan Account Name, Loan Amount, and payment progress; penalty only when past due. */
export function buildReminderMessage(reminder: MockPaymentReminder): string {
  const lines = [
    `Hi ${reminder.borrowerName},`,
    '',
    `This is a reminder from Easycash Lending Company Inc. regarding your loan account ${reminder.loanCode}.`,
    '',
    `Installment #${reminder.installmentNumber} of ${reminder.installmentsTotalCount}: ${formatPeso(reminder.installmentAmountDue)} due ${formatDate(reminder.dueDate)}.`,
    `Payment progress: ${reminder.installmentsPaidCount} of ${reminder.installmentsTotalCount} installments paid so far.`,
  ];
  if (reminder.penaltyDue > 0) {
    lines.push(`Penalty fee for late payment: ${formatPeso(reminder.penaltyDue)}.`);
  }
  lines.push('', 'Please settle at your earliest convenience to avoid additional penalties. Thank you!', '- Easycash Lending Company Inc.');
  return lines.join('\n');
}
