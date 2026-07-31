/**
 * Client-side mirror of the backend's `computeFlatRateAmortization` (app/easycashbackend/src/
 * modules/loan-application/application/config/loanCategoryFlatRates.ts) - same real, verified
 * monthly flat add-on rate (3.0%/month, confirmed 2026-07-11 against the production ledger), same
 * formula. Used only for the public landing page's Loan Calculator widget, an advisory estimate -
 * NOT the real contractual/PMT-based computation used at actual loan booking. Never let this drift
 * from the backend copy; if the backend rate table changes, update this one too.
 */
const LOAN_CATEGORY_MONTHLY_FLAT_RATES: Record<string, number> = {
  'Salary Loan': 0.03,
  'Seafarer Loan': 0.03,
  'Business Loan': 0.03,
};

const DEFAULT_MONTHLY_FLAT_RATE = 0.03;

function getMonthlyFlatRate(loanCategory: string): number {
  return LOAN_CATEGORY_MONTHLY_FLAT_RATES[loanCategory] ?? DEFAULT_MONTHLY_FLAT_RATE;
}

/** amortization = (principal × (1 + monthlyFlatRate × termMonths)) / termMonths */
export function estimateMonthlyPayment(principal: number, termMonths: number, loanCategory: string): number {
  const rate = getMonthlyFlatRate(loanCategory);
  return (principal * (1 + rate * termMonths)) / termMonths;
}

export function estimateTotalRepayment(principal: number, termMonths: number, loanCategory: string): number {
  return estimateMonthlyPayment(principal, termMonths, loanCategory) * termMonths;
}
