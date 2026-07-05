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
  const installmentCount = pick([6, 9, 12, 18, 24]);
  const createdAt = new Date(Date.now() - (200 + Math.floor(rng() * 500)) * 86_400_000);
  const approvedAt = new Date(createdAt.getTime() + 2 * 86_400_000);
  const firstRepaymentDate = addMonths(approvedAt, 1);

  const isActivated = status !== 'PENDING_APPROVAL' && status !== 'APPROVED' && status !== 'CLOSED_REJECTED';
  const activatedAt = isActivated ? approvedAt : null;

  const paidThrough =
    status === 'CLOSED'
      ? installmentCount
      : status === 'ACTIVE_IN_ARREARS'
        ? Math.max(0, Math.floor(installmentCount * 0.2))
        : status === 'ACTIVE'
          ? Math.max(0, Math.floor(installmentCount * (0.3 + rng() * 0.4)))
          : 0;
  const partialFraction = status === 'ACTIVE' || status === 'ACTIVE_IN_ARREARS' ? round2(0.2 + rng() * 0.5) : 0;

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
  { status: 'ACTIVE', hasPenalty: false },
  { status: 'ACTIVE', hasPenalty: false },
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

export const DASHBOARD_SUMMARY = {
  totalActiveLoans: MOCK_LOANS.filter((l) => l.status === 'ACTIVE' || l.status === 'ACTIVE_IN_ARREARS').length,
  totalPortfolioValue: round2(
    MOCK_LOANS.filter((l) => l.status === 'ACTIVE' || l.status === 'ACTIVE_IN_ARREARS').reduce(
      (sum, l) => sum + l.balances.principalBalance,
      0,
    ),
  ),
  totalCollectionsThisMonth: round2(1_245_320 + rng() * 50_000),
  overdueAccounts: MOCK_LOANS.filter((l) => l.status === 'ACTIVE_IN_ARREARS').length,
  overdueAmount: round2(MOCK_LOANS.filter((l) => l.status === 'ACTIVE_IN_ARREARS').reduce((sum, l) => sum + l.collectionsBalance, 0)),
};

const MONTH_LABELS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

export const DISBURSEMENT_TREND = MONTH_LABELS.map((month, i) => ({
  month,
  disbursed: round2(900_000 + i * 60_000 + rng() * 120_000),
}));

export const COLLECTIONS_VS_TARGET = MONTH_LABELS.map((month) => ({
  month,
  target: round2(1_100_000 + rng() * 40_000),
  actual: round2(950_000 + rng() * 250_000),
}));

function buildPortfolioByProduct(): { product: string; value: number }[] {
  const byProduct = new Map<string, number>();
  for (const loan of MOCK_LOANS) {
    if (loan.status !== 'ACTIVE' && loan.status !== 'ACTIVE_IN_ARREARS') continue;
    byProduct.set(loan.productType, round2((byProduct.get(loan.productType) ?? 0) + loan.balances.principalBalance));
  }
  return [...byProduct.entries()].map(([product, value]) => ({ product, value }));
}

export const PORTFOLIO_BY_PRODUCT = buildPortfolioByProduct();

/** Clearly labeled as a sample projection in the UI — not a real forecasting model. */
export const SAMPLE_COLLECTIONS_PROJECTION = ['Aug', 'Sep', 'Oct', 'Nov'].map((month, i) => ({
  month,
  projected: round2(1_050_000 + i * 35_000),
}));

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

// ---------------------------------------------------------------------------
// Repeat-client historical loans — confirmed per this checkpoint: the Loan
// Application detail page must flag when an applicant is already an
// existing client, list their previous EasyCash loan account(s), and let
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
  if (loan.status === 'ACTIVE_IN_ARREARS' || loan.status === 'CLOSED_WRITTEN_OFF') {
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
    assignedSubType: 'SML-Reg',
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
    assignedSubType: 'SL-Reg',
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
      'Qualified — all factors within acceptable range, and repeat-client history supports approval: her previous EasyCash loan (SL-Reg_0900) was paid in full with no late installments, indicating a good payer. Recommended for approval.',
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
      'Does not meet minimum qualification criteria — self-employed income is harder to verify and credit score is near the minimum threshold. Repeat-client history further weighs against approval: her previous EasyCash loan (BL-Reg_0900) was written off delinquent, paid on-time for only 7 of 18 installments before falling behind; reported reason on file was a business slowdown that disrupted her sari-sari store income. Recommended for decline pending manual review.',
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
  params: { productCode: string; principalAmount: number; installmentCount: number },
  actorName: string,
): MockLoanAccount {
  const product = MOCK_LOAN_PRODUCTS.find((p) => p.productCode === params.productCode);
  const prefix = LOAN_GENERATION_CATALOG.find((c) => c.product.productCode === params.productCode)?.codePrefix ?? 'LN';
  const loanCode = nextLoanCode(prefix);
  const id = `loan-client-${Date.now()}`;
  const branch = pick(BRANCHES);
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
    interestRate: product?.defaultInterestRate ?? 0,
    installmentCount: params.installmentCount,
    firstRepaymentDate: addMonths(new Date(), 1).toISOString(),
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
    paymentMethod: 'GCASH',
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
  return loan;
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
