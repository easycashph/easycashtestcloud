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
 * instead of reading the field directly.
 *
 * 2026-09-10 (user request, "Seafarer Loan is the #1 featured product throughout the website"):
 * reordered so Seafarer Loan leads the array - every consumer that renders/derives from this order
 * (the landing page's featured-product row, the nav mega-menu, the mobile drawer, the Requirements
 * page's document cards, LoanProductsPage, the application form's category dropdown, and
 * LoanCalculatorWidget's default selected category) picks this up automatically via `.map()`/
 * `[0]`, with no per-page reordering logic to keep in sync. `category` values themselves are
 * untouched (see 2026-08-12 note above) - this only changes display/array order, never the real
 * backend-facing value.
 *
 * 2026-09-10 (user request, "expand using details fetched from easycash.ph"): added `maxAmount`
 * and `ageRange` per product - CONFIRMED real published figures, read directly off the live
 * easycash.ph product pages (Seafarer Loan, Personal Loan, SME Loan pages, checked this same day),
 * not estimates or UI-convenience bounds like the calculator widgets' own slider ceilings (see
 * those files' doc comments on that distinction). If easycash.ph republishes different figures
 * later, these must be re-verified against the live site, not assumed still current.
 *
 * Deliberately NOT changed this pass: the live site's FAQ states loans are "disbursed via bank
 * transfer, e-wallet, or other supported channels", which conflicts with this Portal's own
 * disbursement disclosure (`t.landing.disbursementNotice` / footer - "released via Bank Cheque
 * only... never disburses in... bank transfer"). That is a real conflict between two claimed
 * sources of truth about actual money movement, not a presentation detail - it needs a business
 * decision from whoever owns that policy, not a silent edit here. */
export const LOAN_PRODUCTS = [
  {
    icon: Anchor,
    category: 'Seafarer Loan',
    displayLabel: 'Seafarer Loan',
    maxAmount: 500_000,
    ageRange: '21-60',
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
  {
    icon: Landmark,
    category: 'Salary Loan',
    displayLabel: 'Personal Loan',
    maxAmount: 300_000,
    ageRange: '21-60',
    blurb: {
      en: 'A quick cash advance against your salary, approved fast.',
      fil: 'Mabilisang cash advance laban sa iyong sahod, mabilis maaprubahan.',
    },
    details: {
      en: 'A short-term cash advance for employees, repaid against your regular paycheck.',
      fil: 'Panandaliang cash advance para sa mga empleyado, babayaran laban sa iyong regular na sahod.',
    },
    image: './images/product-salary.jpg',
  },
  {
    icon: Briefcase,
    category: 'Business Loan',
    displayLabel: 'SME Loan',
    maxAmount: 500_000,
    ageRange: '21-65',
    blurb: {
      en: 'Flexible loan terms and a simpler process for growing your business.',
      fil: 'Flexible na termino ng pautang at mas simpleng proseso para sa paglago ng iyong negosyo.',
    },
    details: {
      en: 'Working capital, equipment, or expansion loans for small and medium-sized business owners.',
      fil: 'Working capital, kagamitan, o pautang para sa pagpapalawak ng maliit at katamtamang laki ng negosyo.',
    },
    image: './images/product-business.jpg',
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
