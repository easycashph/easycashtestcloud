/**
 * Monthly flat add-on rate per loan category, used only to approximate a pre-screening
 * amortization in `LoanApplicationPreQualificationService` — NOT the real contractual/PMT-based
 * computation used at actual loan booking (see `legacy/reports/201 Loan Docs Generator/Sample
 * Computation Sheet updated.xlsx` for that formula).
 *
 * 3.0%/month confirmed 2026-07-11 as the dominant/most-common add-on rate actually used across all
 * three product classes (SL-Regular, SML-Regular, BL-Regular) in the production ledger
 * (`legacy/reports/OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm`). Kept as one constant per
 * category (not a single shared number) so MIS can tune a category's rate independently later
 * without a code change elsewhere.
 */
export const LOAN_CATEGORY_MONTHLY_FLAT_RATES: Record<string, number> = {
  'Salary Loan': 0.03,
  'Seafarer Loan': 0.03,
  'Business Loan': 0.03,
};

/** Falls back to the overall dominant rate (3.0%/month) for any category not explicitly listed. */
export const DEFAULT_MONTHLY_FLAT_RATE = 0.03;

export function getMonthlyFlatRate(loanCategory: string): number {
  return LOAN_CATEGORY_MONTHLY_FLAT_RATES[loanCategory] ?? DEFAULT_MONTHLY_FLAT_RATE;
}

/** amortization = (principal × (1 + monthlyFlatRate × termMonths)) / termMonths */
export function computeFlatRateAmortization(principal: number, termMonths: number, loanCategory: string): number {
  const rate = getMonthlyFlatRate(loanCategory);
  return (principal * (1 + rate * termMonths)) / termMonths;
}
