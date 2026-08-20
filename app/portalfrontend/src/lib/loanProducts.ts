import { Anchor, Briefcase, Landmark } from 'lucide-react';
import type { Locale } from './i18n/LanguageContext';

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
 * only for the value actually sent to the backend. Deliberately not localized like blurb/details/
 * eligibilityNote below - a product name, same posture as "Easycash" itself never being translated.
 *
 * 2026-08-20 bug fix: `blurb`/`details`/`eligibilityNote` used to be plain English strings, so
 * every surrounding UI element translated to Filipino except these - the exact "hardcoded English"
 * bug class already fixed once elsewhere (see LandingPage.tsx's own 2026-07-29 changelog entry)
 * but missed here since this file is shared across four pages, none of which flagged it alone. Now
 * `{ en, fil }` objects - read via `localizedProductText()` below, which every consumer must use
 * instead of reading the field directly. */
export const LOAN_PRODUCTS = [
  {
    icon: Briefcase,
    category: 'Business Loan',
    displayLabel: 'SME Loan',
    blurb: {
      en: 'Flexible financing and a simpler process for growing your business.',
      fil: 'Flexible na financing at mas simpleng proseso para sa paglago ng iyong negosyo.',
    },
    details: {
      en: 'Working capital, equipment, or expansion financing for small and medium-sized business owners.',
      fil: 'Working capital, kagamitan, o financing para sa pagpapalawak ng maliit at katamtamang laki ng negosyo.',
    },
    image: './images/product-business.jpg',
  },
  {
    icon: Landmark,
    category: 'Salary Loan',
    displayLabel: 'Personal Loan',
    blurb: {
      en: 'A quick cash advance against your salary, approved fast.',
      fil: 'Mabilisang cash advance laban sa iyong sahod, mabilis maaprubahan.',
    },
    details: {
      en: 'A short-term cash advance for employees, repaid against your regular paycheck.',
      fil: 'Panandaliang cash advance para sa mga empleyado, babayaran laban sa iyong regular na sahod.',
    },
    image: './images/product-salary.jpg',
    /** 2026-08-14 (business owner confirmed): private-sector employees only - Easycash does not
     * currently accept government employees for this product. */
    eligibilityNote: {
      en: 'For private-sector employees only. Easycash does not currently accept government employees for this product.',
      fil: 'Para sa mga empleyado ng pribadong sektor lamang. Hindi pa tumatanggap ang Easycash ng mga government employee para sa produktong ito.',
    },
  },
  {
    icon: Anchor,
    category: 'Seafarer Loan',
    displayLabel: 'Seafarer Loan',
    blurb: {
      en: 'Lower rates and faster approvals, tailored around irregular allotment income.',
      fil: 'Mas mababang rate at mas mabilis na approval, iniangkop sa hindi regular na allotment income.',
    },
    details: {
      en: 'Built for seafarers with allotment-based income - flexible terms around your contract and deployment schedule.',
      fil: 'Ginawa para sa mga seafarer na may allotment-based na kita - flexible na termino ayon sa iyong kontrata at deployment schedule.',
    },
    image: './images/product-seafarer.jpg',
  },
] as const;

/** Every consumer of blurb/details/eligibilityNote must go through this - see LOAN_PRODUCTS's own
 * 2026-08-20 doc comment for why the fields are `{ en, fil }` objects instead of plain strings. */
export function localizedProductText(text: { en: string; fil: string }, locale: Locale): string {
  return text[locale];
}

/** 2026-08-12 (CEO request, Portal display only) - looks up the Portal-facing rename for a stored
 * `requestedCategory` value (e.g. an existing application's category on the Dashboard/detail view).
 * Falls back to the raw value for any category not in the catalog above, so this never hides data
 * for an unexpected value. */
export function getLoanProductDisplayLabel(category: string): string {
  return LOAN_PRODUCTS.find((p) => p.category === category)?.displayLabel ?? category;
}
