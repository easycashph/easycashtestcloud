/**
 * Genuine static configuration - NOT fake/sample business data. Company identity, the fixed
 * payment-method and intake-document catalogs, and staff role names are all real, fixed reference
 * values with no backend-hosted source of truth of their own (no `GET /company-info` or
 * `GET /payment-methods` endpoint exists, nor is one needed - these don't change at runtime).
 * Split out from the old `mockData.ts` (2026-07-12) once every page that used to fall back to that
 * file's fabricated sample records was migrated to real API data - this is what was left over that
 * genuinely wasn't mock data to begin with.
 */

export const COMPANY_INFO = {
  name: 'Easycash Lending Company Inc.',
  branchName: 'Manila',
  address: 'Unit 9, G/F The Midland Plaza, M. Adriatico St., Barangay 669, Ermita, Manila',
} as const;

export interface PaymentMethod {
  code: string;
  label: string;
  isActive: boolean;
  legacyNote?: string;
}

export const ACTIVE_PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'GCASH', label: 'GCash', isActive: true },
  { code: 'CASH', label: 'Cash', isActive: true },
  { code: 'BANK_TRANSFER', label: 'Bank Transfer', isActive: true },
  { code: 'PDC', label: 'Post-Dated Check (PDC)', isActive: true },
  { code: 'RESTRUCTURE', label: 'Restructured', isActive: true },
  { code: 'SUSPENSE_ACCOUNT', label: 'Suspense Account', isActive: true },
  { code: 'ADA', label: 'ADA', isActive: true },
  { code: 'UNEARNED_INCOME', label: 'Unearned Income', isActive: true },
  { code: 'ADJUSTMENT', label: 'Adjustment', isActive: true },
  { code: 'BANK', label: 'Bank', isActive: true },
  { code: 'RECEIPT', label: 'Receipt', isActive: true },
  { code: 'CHECK', label: 'Check', isActive: true },
  { code: 'LOAN_DEDUCT', label: 'Loan Deduct', isActive: true },
  { code: 'ATM', label: 'ATM', isActive: true },
];

const LEGACY_NOTE =
  'Historical payment channel from the legacy system - retained because past transactions used it; not offered for new payments.';

export const DISCONTINUED_PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'DRAGONPAY', label: 'DragonPay', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'ECPAY', label: 'ECPay', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'BAYAD_CENTER', label: 'Bayad Center', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'LBC', label: 'LBC', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'WESTERN_UNION', label: 'Western Union', isActive: false, legacyNote: LEGACY_NOTE },
  { code: 'PALAWAN_PAWNSHOP', label: 'Palawan Pawnshop', isActive: false, legacyNote: LEGACY_NOTE },
];

const ALL_PAYMENT_METHODS: PaymentMethod[] = [...ACTIVE_PAYMENT_METHODS, ...DISCONTINUED_PAYMENT_METHODS];

export function getPaymentMethodLabel(code: string): string {
  return ALL_PAYMENT_METHODS.find((m) => m.code === code)?.label ?? code;
}

export function isDiscontinuedPaymentMethod(code: string): boolean {
  return ALL_PAYMENT_METHODS.find((m) => m.code === code)?.isActive === false;
}

export type LmsRole = 'MIS' | 'Super Admin' | 'Loan Operation Manager' | 'CRM' | 'Finance' | 'Accounting' | 'Collection Officer';
