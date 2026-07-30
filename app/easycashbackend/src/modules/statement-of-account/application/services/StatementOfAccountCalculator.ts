import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';

/** Same ₱10,000 threshold as ADR-050, but applied per-installment here (2026-07-19, user request) rather than against the whole loan's principal. */
const SMALL_BALANCE_THRESHOLD = Money.of('10000.00');
const SMALL_BALANCE_RATE = new Decimal('0.05');
const STANDARD_RATE = new Decimal('0.10');

export interface RemainingScheduleRow {
  dueDate: Date;
  principal: Money;
  interest: Money;
  totalDue: Money;
}

export interface StatementOfAccountFigures {
  /** Total due on the next unpaid installment whose due date is AFTER `penaltyToDate` (0 if every installment is already due on/before that date). */
  currentAmortizationDue: Money;
  pastDuePrincipal: Money;
  pastDueInterest: Money;
  pastDuePenalty: Money;
  /** Principal + Interest + Penalty past due — the base the Accrued Interest formula multiplies against. */
  totalPastDue: Money;
  accruedInterest: Money;
  /** Every installment with a positive remaining balance, oldest first — the "Remaining Amortization" table (date-independent). */
  remainingSchedule: RemainingScheduleRow[];
}

/** Whole days from `from` to `to` (>= 0) — calendar-day difference, not a 24h-multiple wall-clock diff. */
function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24)));
}

/**
 * Statement of Account figures — sourced from the user's own legacy Excel/VBA tool
 * (`legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`'s `vbaProject.bin`, full source shared 2026-07-19),
 * confirmed directly with the user rather than invented, with two deliberate departures from that
 * source confirmed the same day (see the Penalty section below). See ADR-052 §4/§5 for the full
 * citation and history of corrections.
 *
 * **Past Due bucket** (Principal, Interest) — an installment counts as Past Due when its `dueDate
 * <= penaltyToDate` (staff-entered, NOT real "today" — lets staff check the account as of any date)
 * AND it isn't already fully settled (unpaid Principal + Interest > 0). Deliberately NOT
 * `RepaymentInstallment.status === 'LATE'` (always relative to the real clock) — the whole point of
 * a manual "as of" date is that Past Due must be evaluated against IT, not against right-now.
 *
 * **Penalty** (2026-07-19, user request — departs from the legacy tool's own per-installment
 * `DateDiff(dueDate, cutoffDate)` day count):
 *
 *   Penalty (per qualifying installment) = (unpaid Principal + Interest) x Days(penaltyFromDate,
 *   penaltyToDate) x (rate / 30)
 *
 * `penaltyFromDate` and `penaltyToDate` are BOTH manually entered by staff and apply as ONE SHARED
 * date range across every Past Due installment (not each installment's own due date as "from") —
 * lets staff preview "what if penalty only accrued from this date" (e.g. a negotiated grace period
 * or collection-intervention date) rather than being locked to each installment's own due date.
 * `rate` is 5%/month if THAT installment's own unpaid Principal + Interest <= ₱10,000, else
 * 10%/month (same ₱10,000 threshold as ADR-050, but evaluated per-installment here, not against the
 * whole loan's principal) — flat, non-compounding, no grace period, matching the legacy tool's own
 * flat-rate mechanics otherwise.
 *
 * **Current Amortization Due** — the next unpaid installment whose `dueDate` is AFTER
 * `penaltyToDate` (mirrors `btnCreateSOA_Click`'s "current month" bucket, generalized from "the
 * real calendar month" to "after the staff-chosen date").
 *
 * **Accrued Interest** — from the "NEW ACCRUED INTEREST FORMULA ENGINE" comment block in the VBA:
 *
 *   Accrued Interest = (Total Past Due [Principal + Interest + Penalty] x Contractual Rate) / 30 x Days Late
 *
 * where Days Late = whole days from the Maturity Date (last installment's due date) to
 * `accruedInterestAsOfDate` — a SEPARATE, independent manually-entered date from the Penalty range
 * (matches the legacy tool's own independent "To Date" field for this section) — clamped to 0 when
 * that date has not yet reached maturity (no accrual before then).
 *
 * Collection Fee and Other Fee are NOT computed here — confirmed (per the same legacy tool's
 * `txtCollectionFee`/`txtotherfee` manual text boxes) to be staff-entered per generation, so the
 * caller supplies them directly when persisting/merging (see `GenerateStatementOfAccountUseCase`).
 *
 * **2026-07-28 (user-confirmed, ADR-052 addendum):** for a PROSPECTIVE (non-migrated) loan, the
 * Penalty figure no longer uses the flat/shared-date-range formula described above at all — it
 * calls `resolveComputedPenalty()` per qualifying installment instead, the exact same function the
 * live Repayment Schedule uses (`ADR-050`), so Live and SOA are identical by construction rather
 * than two independently-maintained formulas. Pass `livePenaltyContext` to opt into this path;
 * `penaltyFromDate` is then ignored entirely (each installment supplies its own due date
 * automatically). Migrated loans (no `livePenaltyContext`) keep the flat/shared-range formula
 * exactly as before — `resolveComputedPenalty` has no live figure for them anyway.
 */
export class StatementOfAccountCalculator {
  static calculate(
    installments: RepaymentInstallment[],
    contractualRate: Percentage | undefined,
    penaltyFromDate: Date | undefined,
    penaltyToDate: Date,
    accruedInterestAsOfDate: Date,
    livePenaltyContext?: PenaltyComputationContext,
  ): StatementOfAccountFigures {
    const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const lastInstallment = sorted[sorted.length - 1];

    const outstandingPrincipal = (i: RepaymentInstallment) => i.due.principal.subtract(i.paid.principal);
    const outstandingInterest = (i: RepaymentInstallment) => i.due.interest.subtract(i.paid.interest);
    const outstandingBase = (i: RepaymentInstallment) => outstandingPrincipal(i).add(outstandingInterest(i));

    const penaltyDays = livePenaltyContext || !penaltyFromDate ? 0 : daysBetween(penaltyFromDate, penaltyToDate);

    let pastDuePrincipal = Money.ZERO;
    let pastDueInterest = Money.ZERO;
    let pastDuePenalty = Money.ZERO;

    for (const installment of sorted) {
      if (installment.dueDate.getTime() > penaltyToDate.getTime()) continue; // not yet due as of the chosen date
      const unpaidPrincipal = outstandingPrincipal(installment);
      const unpaidInterest = outstandingInterest(installment);
      const unpaidBase = unpaidPrincipal.add(unpaidInterest);
      if (!unpaidBase.isPositive()) continue; // already fully settled as of this date

      if (unpaidPrincipal.isPositive()) pastDuePrincipal = pastDuePrincipal.add(unpaidPrincipal);
      if (unpaidInterest.isPositive()) pastDueInterest = pastDueInterest.add(unpaidInterest);

      if (livePenaltyContext) {
        pastDuePenalty = pastDuePenalty.add(resolveComputedPenalty(installment, livePenaltyContext, penaltyToDate));
      } else if (penaltyDays > 0) {
        const rate = unpaidBase.greaterThan(SMALL_BALANCE_THRESHOLD) ? STANDARD_RATE : SMALL_BALANCE_RATE;
        const rowPenalty = Money.of(
          unpaidBase.toDecimal().times(penaltyDays).times(rate).dividedBy(30).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        );
        pastDuePenalty = pastDuePenalty.add(rowPenalty);
      }
    }

    const totalPastDue = pastDuePrincipal.add(pastDueInterest).add(pastDuePenalty);

    const currentInstallment = sorted.find(
      (i) => i.dueDate.getTime() > penaltyToDate.getTime() && outstandingBase(i).isPositive(),
    );
    const currentAmortizationDue = currentInstallment ? outstandingBase(currentInstallment) : Money.ZERO;

    let accruedInterest = Money.ZERO;
    if (lastInstallment && contractualRate && !contractualRate.isZero() && totalPastDue.isPositive()) {
      const daysLate = daysBetween(lastInstallment.dueDate, accruedInterestAsOfDate);
      if (daysLate > 0) {
        const dailyBase = totalPastDue.toDecimal().times(contractualRate.asFraction()).dividedBy(30);
        accruedInterest = Money.of(dailyBase.times(daysLate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
      }
    }

    const remainingSchedule: RemainingScheduleRow[] = sorted
      .filter((i) => outstandingBase(i).isPositive())
      .map((i) => ({
        dueDate: i.dueDate,
        principal: outstandingPrincipal(i),
        interest: outstandingInterest(i),
        totalDue: outstandingBase(i),
      }));

    return {
      currentAmortizationDue,
      pastDuePrincipal,
      pastDueInterest,
      pastDuePenalty,
      totalPastDue,
      accruedInterest,
      remainingSchedule,
    };
  }
}
