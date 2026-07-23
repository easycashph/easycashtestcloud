import { Anchor, Briefcase, Landmark } from 'lucide-react';

/** Shared between LandingPage (public marketing) and LoanProductsPage (logged-in "which loan
 * should I apply for" browser) - single source of truth so the two never drift, and so
 * `category` here always matches LOAN_CATEGORIES in LoanApplicationFormPage.tsx exactly (it's
 * passed straight through as the `requestedCategory` query param when a client clicks Apply Now).
 *
 * 2026-07-23 (user correction): only 3 products are actually active in Easycash's catalog today -
 * Business Loan, Salary Loan, Seafarer Loan - matching app/frontend's staff-facing form's own
 * LOAN_TYPE_OPTIONS exactly. Personal Loan/SME Loan/Purchase Financing were never real offerings;
 * removed rather than just hidden, since they don't exist as loan-application categories at all. */
export const LOAN_PRODUCTS = [
  {
    icon: Briefcase,
    category: 'Business Loan',
    blurb: 'Flexible financing and a simpler process for growing your business.',
    details: 'Working capital, equipment, or expansion financing for business owners.',
  },
  {
    icon: Landmark,
    category: 'Salary Loan',
    blurb: 'A quick cash advance against your salary, approved fast.',
    details: 'A short-term cash advance for employees, repaid against your regular paycheck.',
  },
  {
    icon: Anchor,
    category: 'Seafarer Loan',
    blurb: 'Lower rates and faster approvals, tailored around irregular allotment income.',
    details: 'Built for seafarers with allotment-based income - flexible terms around your contract and deployment schedule.',
  },
] as const;
