import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import { manilaDaysBetween } from '@shared/domain/manilaTime';

export interface AccruedInterestBreakdownRow {
  installmentNumber: number;
  dueDate: Date;
  unpaidPrincipal: Money;
  unpaidInterest: Money;
  frozenPenalty: Money;
}

export interface AccruedInterestFigures {
  /** Latest `dueDate` across the whole schedule - same definition as the "Matured" badge. */
  maturityDate: Date;
  totalPastDuePrincipal: Money;
  totalPastDueInterest: Money;
  totalPastDuePenalty: Money;
  /** Principal + Interest + Penalty, past-due-and-unpaid installments only - the base the formula multiplies against. */
  totalPastDue: Money;
  /** Whole calendar days from `maturityDate` to `asOfDate` - 0 before/at maturity. */
  daysLate: number;
  contractualRate: Percentage | undefined;
  /** = (totalPastDue x contractualRate) / 30 x daysLate - 0 if not yet past maturity, no unpaid balance, or no contractual rate set. */
  accruedInterest: Money;
  breakdown: AccruedInterestBreakdownRow[];
  /**
   * 2026-07-24 (user-confirmed, Loan Restructure follow-up): what a Restructure would set the new
   * loan's principal to RIGHT NOW - unpaid Principal + unpaid Interest across the WHOLE remaining
   * schedule (every installment, due or not) + unpaid Penalty (every installment, naturally ₱0
   * for a not-yet-due one) + `accruedInterest` above + unpaid Fees. Exposed here (not just
   * computed inside `RestructureLoanUseCase`) so the Loan Detail page's Restructure dialog can
   * preview the exact figure the backend will actually charge, from the one query it already
   * makes - see `RestructureLoanUseCase`'s own doc comment for why this differs in SCOPE (whole
   * loan, not just past-due) from every other field on this interface.
   */
  restructureNewPrincipal: Money;
}

/**
 * 2026-07-24 (user-confirmed, automatic Loan Detail counterpart to the Statement of Account's
 * manual Accrued Interest section): once a loan matures (its last installment's due date has
 * passed) and still has an unpaid balance, this system continues charging INTEREST on the total
 * past-due balance - not more penalty, which the `CurrentPenaltyResolver` maturity-date cap
 * already freezes as of that same date (see that resolver's own doc comment).
 *
 * Deliberately NOT a reuse of `StatementOfAccountCalculator` - that formula's own Penalty bucket
 * is a separate, staff-entered-date-range, flat-rate figure (confirmed manual-only, per the
 * legacy Excel tool it was sourced from); this one is fully automatic, "as of today," and reuses
 * the SAME frozen-at-maturity penalty figure already shown per-installment on the Repayment
 * Schedule (`resolveComputedPenalty` with `maturityDate` capping), not a second penalty formula.
 *
 * Formula: Accrued Interest = (Total Past Due [Principal + Interest + frozen Penalty] x
 * Contractual Rate) / 30 x Days Late, where Days Late = whole days from the maturity date to
 * `asOfDate` - matches the legacy tool's "NEW ACCRUED INTEREST FORMULA ENGINE" (same one
 * `StatementOfAccountCalculator` cites), just fed a different (automatic) Total Past Due basis.
 */
export class AccruedInterestCalculator {
  static calculate(
    installments: RepaymentInstallment[],
    penaltyContext: Omit<PenaltyComputationContext, 'maturityDate'>,
    contractualRate: Percentage | undefined,
    asOfDate: Date = new Date(),
  ): AccruedInterestFigures {
    const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const maturityDate = sorted.reduce((latest, i) => (i.dueDate > latest ? i.dueDate : latest), sorted[0]?.dueDate ?? asOfDate);
    const fullContext: PenaltyComputationContext = { ...penaltyContext, maturityDate };

    let totalPastDuePrincipal = Money.ZERO;
    let totalPastDueInterest = Money.ZERO;
    let totalPastDuePenalty = Money.ZERO;
    const breakdown: AccruedInterestBreakdownRow[] = [];

    for (const installment of sorted) {
      if (installment.dueDate.getTime() > asOfDate.getTime()) continue; // not yet due
      const unpaidPrincipal = installment.due.principal.subtract(installment.paid.principal);
      const unpaidInterest = installment.due.interest.subtract(installment.paid.interest);
      if (!unpaidPrincipal.add(unpaidInterest).isPositive()) continue; // fully settled already

      const frozenPenalty = resolveComputedPenalty(installment, fullContext, asOfDate);

      totalPastDuePrincipal = totalPastDuePrincipal.add(unpaidPrincipal);
      totalPastDueInterest = totalPastDueInterest.add(unpaidInterest);
      totalPastDuePenalty = totalPastDuePenalty.add(frozenPenalty);
      breakdown.push({ installmentNumber: installment.installmentNumber, dueDate: installment.dueDate, unpaidPrincipal, unpaidInterest, frozenPenalty });
    }

    const totalPastDue = totalPastDuePrincipal.add(totalPastDueInterest).add(totalPastDuePenalty);
    const daysLate = manilaDaysBetween(maturityDate, asOfDate);

    let accruedInterest = Money.ZERO;
    if (contractualRate && !contractualRate.isZero() && totalPastDue.isPositive() && daysLate > 0) {
      const dailyBase = totalPastDue.toDecimal().times(contractualRate.asFraction()).dividedBy(30);
      accruedInterest = Money.of(dailyBase.times(daysLate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    }

    // Whole-loan (not just past-due) totals, for restructureNewPrincipal only - see that field's
    // own doc comment for why this is a deliberately different scope from every field above it.
    let wholeLoanUnpaidPrincipal = Money.ZERO;
    let wholeLoanUnpaidInterest = Money.ZERO;
    let wholeLoanUnpaidFees = Money.ZERO;
    let wholeLoanUnpaidPenalty = Money.ZERO;
    for (const installment of sorted) {
      wholeLoanUnpaidPrincipal = wholeLoanUnpaidPrincipal.add(installment.due.principal.subtract(installment.paid.principal));
      wholeLoanUnpaidInterest = wholeLoanUnpaidInterest.add(installment.due.interest.subtract(installment.paid.interest));
      wholeLoanUnpaidFees = wholeLoanUnpaidFees.add(installment.due.fees.subtract(installment.paid.fees));
      wholeLoanUnpaidPenalty = wholeLoanUnpaidPenalty.add(resolveComputedPenalty(installment, fullContext, asOfDate));
    }
    const restructureNewPrincipal = wholeLoanUnpaidPrincipal
      .add(wholeLoanUnpaidInterest)
      .add(wholeLoanUnpaidPenalty)
      .add(accruedInterest)
      .add(wholeLoanUnpaidFees);

    return {
      maturityDate,
      totalPastDuePrincipal,
      totalPastDueInterest,
      totalPastDuePenalty,
      totalPastDue,
      daysLate,
      contractualRate,
      accruedInterest,
      breakdown,
      restructureNewPrincipal,
    };
  }
}
