import { Money } from '@shared/domain/Money';

/**
 * BSP Circular No. 1133, Series of 2021 / SEC Memorandum Circular No. 3, Series of 2022 —
 * "Ceiling/s on Interest Rates and Other Fees Charged by Lending Companies (LCs), Financing
 * Companies (FCs), and their Online Lending Platforms (OLPs)".
 *
 * Sourced directly from the real regulation text, not invented (2026-07-20, user-supplied):
 * `legacy/SEC/BSP1133.pdf` (the circular itself, Section 1) and
 * `legacy/SEC/2022FAQs_Sample-Computations-on-SEC-MC-3__14June2022.pdf` (SEC's own FAQ, §II.2).
 *
 * A loan is "covered" by the ceilings ONLY when ALL FOUR of the following are true concurrently
 * (per the FAQ's own emphasis: "if one of the four components is not satisfied, the caps will
 * not apply to the loan product"):
 *
 *   a. Unsecured, general-purpose loan.
 *   b. Principal amount does not exceed ₱10,000.
 *   c. Loan tenor of up to four (4) months.
 *   d. Entered into, restructured, or renewed on or after 03 March 2022 (SEC MC 3's effectivity).
 *
 * See ADR-053 for the full compliance scope, the ceilings themselves (5%/month penalty cap,
 * 6%/month nominal rate cap, 15%/month EIR cap, 100% total-cost cap), and which of Easycash's
 * loan products have been confirmed (a) so far — confirming (a) for a product is a business/legal
 * classification decision that requires explicit user confirmation per product; this module never
 * infers it (CLAUDE.md: never fabricate financial/compliance logic).
 */

/** SEC MC 3 §II.2(b) / BSP Circular 1133 §1: "do not exceed the amount of P10,000". */
export const SEC_MC3_MAX_PRINCIPAL = Money.of('10000.00');

/** SEC MC 3 §II.2(c) / BSP Circular 1133 §1: "loan tenor of up to four (4) months". Assumes `RepaymentPeriodUnit.MONTHS` — this module does not itself validate the unit. */
export const SEC_MC3_MAX_TENOR_MONTHS = 4;

/** SEC MC 3 §II.2(d): "entered into, restructured, or renewed beginning 03 March 2022, the date of effectivity of SEC MC3." */
export const SEC_MC3_EFFECTIVITY_DATE = new Date('2022-03-03T00:00:00.000Z');

/** BSP Circular 1133 §1(3) / SEC MC 3 FAQ §I.3: "Five percent (5%) per month on outstanding scheduled amount due" — read as simple (non-compounding), unlike ADR-050's own compounding formula used for non-covered loans elsewhere in this system. */
export const SEC_MC3_PENALTY_RATE_PERCENT_PER_MONTH = 5;

/** BSP Circular 1133 §1(1): "Six percent (6%) per month (~0.2 percent per day)". */
export const SEC_MC3_NOMINAL_RATE_CEILING_PERCENT_PER_MONTH = 6;

/** BSP Circular 1133 §1(2): "Fifteen percent (15%) per month (~0.5 percent per day)" — includes nominal interest + all other fees/charges, EXCLUDING penalties/late-payment fees. */
export const SEC_MC3_EIR_CEILING_PERCENT_PER_MONTH = 15;

/** BSP Circular 1133 §1(4): "One hundred percent (100%) of total amount borrowed (applying to all interest, other fees and charges, and penalties) regardless of time the loan has been outstanding." */
export const SEC_MC3_TOTAL_COST_CAP_PERCENT = 100;

export interface SecMc3CoverageInput {
  principalAmount: Money;
  /** Loan tenor, in months (matches `LoanAccount.installmentCount` for a MONTHS-unit product). */
  installmentCount: number;
  /** LoanProduct-level classification — see `LoanProduct.isUnsecuredGeneralPurpose`'s own doc comment (schema.prisma) for how/when this gets confirmed. */
  isUnsecuredGeneralPurpose: boolean;
  /** The date the loan was entered into, restructured, or renewed. */
  originationDate: Date;
}

/**
 * Whether a loan is subject to the BSP 1133 / SEC MC 3 ceilings — ALL FOUR criteria must hold
 * concurrently (see this file's own doc comment for the citations).
 */
export function isSecMc3Covered(input: SecMc3CoverageInput): boolean {
  return (
    input.isUnsecuredGeneralPurpose &&
    !input.principalAmount.greaterThan(SEC_MC3_MAX_PRINCIPAL) &&
    input.installmentCount <= SEC_MC3_MAX_TENOR_MONTHS &&
    input.originationDate.getTime() >= SEC_MC3_EFFECTIVITY_DATE.getTime()
  );
}
