import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { AmortizationScheduleGenerator } from '@shared/domain/calculation/AmortizationScheduleGenerator';

/**
 * 2026-09-14 (user request): the Loan Application stage's pre-screening estimate previously used
 * `computeFlatRateAmortization` (loanCategoryFlatRates.ts) - a simple add-on-rate approximation,
 * deliberately NOT the same Declining-Balance PMT formula `AmortizationScheduleGenerator` runs for
 * a real, booked LoanAccount. That gap existed because a real Contractual Rate is normally looked
 * up from `interest_rate_chart` by (Add-On Rate, Term) at LOAN ACCOUNT creation time
 * (`Create Loan Account, Contractual Rate auto-fill` - see that model's own schema.prisma doc
 * comment) - and a LoanApplication has neither a chosen Add-On Rate nor an assigned
 * LoanProductVersion yet at the point DTI/pre-qualification is computed (product assignment only
 * happens later, at PRE_APPROVAL - see LoanApplication.assignProduct()'s own doc comment).
 *
 * This snapshot closes that gap without threading a DB call through
 * `LoanApplicationPreQualificationService.evaluateCriteria()` (deliberately pure/no-I/O - see its
 * own doc comment - so the Detail page can show a live "why" breakdown on every read with no
 * extra network round-trip): it's the REAL `interest_rate_chart` row set for the SAME 3.0%/month
 * add-on rate `loanCategoryFlatRates.ts` already assumed (DEFAULT_MONTHLY_FLAT_RATE) - copied
 * verbatim from the live table (confirmed 2026-09-14, `SELECT * FROM interest_rate_chart WHERE
 * "addOnRatePercent" = 3.000`), not invented. If `interest_rate_chart`'s 3.0%-addOn rows ever
 * change, this snapshot must be re-synced by hand - there is no automatic link between the two.
 *
 * Every loan application on record so far requests a term within 1-12 months (confirmed
 * 2026-09-14: `SELECT min/max("requestedTermMonths") FROM loan_applications`), so this snapshot's
 * coverage is not a known gap today - but `computeEstimatedAmortization` throws rather than
 * silently extrapolating for a term outside it, per CLAUDE.md's "never fabricate financial logic."
 */
const CONTRACTUAL_RATE_PERCENT_BY_TERM_MONTHS: Record<number, number> = {
  1: 3.0,
  2: 3.98,
  3: 4.43,
  4: 4.7,
  5: 4.85,
  6: 4.95,
  7: 5.01,
  8: 5.05,
  9: 5.07,
  10: 5.08,
  11: 5.08,
  12: 5.08,
};

/**
 * Same Declining-Balance PMT formula a real LoanAccount's amortization schedule runs
 * (`AmortizationScheduleGenerator`), fed the real Contractual Rate for a 3.0%/month Add-On Rate at
 * this term (see this file's own doc comment for where that rate snapshot comes from) - the
 * pre-screening estimate this function returns is the same figure `monthlyPayment` would show for
 * installment 1 of a real loan booked on these exact terms.
 */
export function computeEstimatedAmortization(principal: number, termMonths: number): number {
  const contractualRatePercent = CONTRACTUAL_RATE_PERCENT_BY_TERM_MONTHS[termMonths];
  if (contractualRatePercent === undefined) {
    throw new Error(
      `No contractual rate on file for a ${termMonths}-month term at the 3.0% add-on rate this pre-screening estimate assumes - ` +
        `only 1-12 months are covered. Re-sync loanApplicationContractualRates.ts against interest_rate_chart if this term is now real.`,
    );
  }
  const { monthlyPayment } = AmortizationScheduleGenerator.generate(Money.of(principal), Percentage.of(contractualRatePercent), termMonths);
  return monthlyPayment.toDecimal().toNumber();
}
