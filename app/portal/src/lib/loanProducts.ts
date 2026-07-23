import { Anchor, Briefcase, Landmark, User, Wallet } from 'lucide-react';

/** Shared between LandingPage (public marketing) and LoanProductsPage (logged-in "which loan
 * should I apply for" browser) - single source of truth so the two never drift, and so
 * `category` here always matches LOAN_CATEGORIES in LoanApplicationFormPage.tsx exactly (it's
 * passed straight through as the `requestedCategory` query param when a client clicks Apply Now). */
export const LOAN_PRODUCTS = [
  {
    icon: Anchor,
    category: 'Seafarer Loan',
    blurb: 'Lower rates and faster approvals, tailored around irregular allotment income.',
    details: 'Built for seafarers with allotment-based income - flexible terms around your contract and deployment schedule.',
  },
  {
    icon: User,
    category: 'Personal Loan',
    blurb: 'Tuition, bills, home improvement, or the unexpected - competitive rates, no surprises.',
    details: 'For everyday needs - school fees, medical expenses, home repairs, or anything else life throws your way.',
  },
  {
    icon: Briefcase,
    category: 'SME Loan',
    blurb: 'Flexible financing and a simpler process for growing your business.',
    details: 'Working capital, equipment, or expansion financing for small and medium business owners.',
  },
  {
    icon: Landmark,
    category: 'Salary Loan',
    blurb: 'A quick cash advance against your salary, approved fast.',
    details: 'A short-term cash advance for employees, repaid against your regular paycheck.',
  },
  {
    icon: Wallet,
    category: 'Purchase Financing',
    blurb: 'Gadgets and appliances now, pay over time.',
    details: 'Get the gadget or appliance you need today and pay it off in manageable installments.',
  },
] as const;
