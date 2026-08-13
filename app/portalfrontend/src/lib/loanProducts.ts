import { Anchor, Briefcase, Landmark } from 'lucide-react';

/** Shared between LandingPage (public marketing) and LoanProductsPage (logged-in "which loan
 * should I apply for" browser) - single source of truth so the two never drift, and so
 * `category` here always matches LOAN_CATEGORIES in LoanApplicationFormPage.tsx exactly (it's
 * passed straight through as the `requestedCategory` query param when a client clicks Apply Now).
 *
 * 2026-07-23 (user correction): only 3 products are actually active in Easycash's catalog today -
 * Business Loan, Salary Loan, Seafarer Loan - matching app/frontend's staff-facing form's own
 * LOAN_TYPE_OPTIONS exactly. Personal Loan/SME Loan/Purchase Financing were never real offerings;
 * removed rather than just hidden, since they don't exist as loan-application categories at all.
 *
 * 2026-08-12 (CEO request, Portal display only): `category` MUST stay 'Business Loan'/'Salary
 * Loan' - it's the exact `requestedCategory` value persisted on the LoanApplication record and
 * matched against loan product versions/pre-qualification rules, and the LMS's own
 * LOAN_TYPE_OPTIONS still uses these same values, so changing it here would silently break every
 * application submitted through the Portal. `displayLabel` is the Portal-only rename ("SME Loan" /
 * "Personal Loan") - use it for anything user-facing (cards, dropdown option text); use `category`
 * only for the value actually sent to the backend. */
export const LOAN_PRODUCTS = [
  {
    icon: Briefcase,
    category: 'Business Loan',
    displayLabel: 'SME Loan',
    blurb: 'Flexible financing and a simpler process for growing your business.',
    details: 'Working capital, equipment, or expansion financing for small and medium-sized business owners.',
    image: './images/product-business.jpg',
  },
  {
    icon: Landmark,
    category: 'Salary Loan',
    displayLabel: 'Personal Loan',
    blurb: 'A quick cash advance against your salary, approved fast.',
    details: 'A short-term cash advance for employees, repaid against your regular paycheck.',
    image: './images/product-salary.jpg',
    /** 2026-08-14 (business owner confirmed): private-sector employees only - Easycash does not
     * currently accept government employees for this product. */
    eligibilityNote: 'For private-sector employees only. Easycash does not currently accept government employees for this product.',
  },
  {
    icon: Anchor,
    category: 'Seafarer Loan',
    displayLabel: 'Seafarer Loan',
    blurb: 'Lower rates and faster approvals, tailored around irregular allotment income.',
    details: 'Built for seafarers with allotment-based income - flexible terms around your contract and deployment schedule.',
    image: './images/product-seafarer.jpg',
  },
] as const;

/** 2026-08-12 (CEO request, Portal display only) - looks up the Portal-facing rename for a stored
 * `requestedCategory` value (e.g. an existing application's category on the Dashboard/detail view).
 * Falls back to the raw value for any category not in the catalog above, so this never hides data
 * for an unexpected value. */
export function getLoanProductDisplayLabel(category: string): string {
  return LOAN_PRODUCTS.find((p) => p.category === category)?.displayLabel ?? category;
}
