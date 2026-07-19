import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';

export interface RemainingScheduleRow {
  dueDate: Date;
  principal: Money;
  interest: Money;
  totalDue: Money;
}

export interface StatementOfAccountFigures {
  /** Total due on the next unpaid installment whose due date is AFTER `penaltyAsOfDate` (0 if every installment is already due on/before that date). */
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
 * confirmed directly with the user rather than invented. See ADR-052 §4/§5 for the full citation.
 *
 * **Past Due bucket** (Principal, Interest, Penalty) — matches `btnApplyPenalties_Click`: an
 * installment counts as Past Due when its `dueDate <= penaltyAsOfDate` (the staff-entered "as of"
 * date, NOT real "today" — lets staff check the account as of any date) AND it isn't already fully
 * settled (unpaid Principal + Interest > 0). This is deliberately NOT `RepaymentInstallment.status
 * === 'LATE'` (which is always relative to the real clock) — the whole point of a manual "as of"
 * date is that Past Due must be evaluated against IT, not against right-now.
 *
 * **Penalty formula** — matches `btnApplyPenalties_Click`/`btnLoadSchedule_Click` exactly (confirmed
 * 2026-07-19: use this flat legacy formula, not the system's own ADR-050 compounding/size-tiered/
 * grace-period formula used elsewhere, e.g. the Loan Detail page - a deliberate choice specific to
 * this document):
 *
 *   Penalty (per installment) = (unpaid Principal + Interest) x Days Late x (10% / 30)
 *
 * where Days Late = whole days from that installment's `dueDate` to `penaltyAsOfDate` (0, hence no
 * penalty, for an installment due exactly on `penaltyAsOfDate`). Flat 10%/month for every loan
 * regardless of size, no grace period, simple (non-compounding) daily proration.
 *
 * **Current Amortization Due** — the next unpaid installment whose `dueDate` is AFTER
 * `penaltyAsOfDate` (mirrors `btnCreateSOA_Click`'s "current month" bucket, generalized from
 * "the real calendar month" to "after the staff-chosen date").
 *
 * **Accrued Interest** — from the "NEW ACCRUED INTEREST FORMULA ENGINE" comment block in the VBA:
 *
 *   Accrued Interest = (Total Past Due [Principal + Interest + Penalty] x Contractual Rate) / 30 x Days Late
 *
 * where Days Late = whole days from the Maturity Date (last installment's due date) to
 * `accruedInterestAsOfDate` — a SEPARATE, independent manually-entered date from `penaltyAsOfDate`
 * (matches the legacy tool's own two independent "To Date" fields) — clamped to 0 when that date
 * has not yet reached maturity (no accrual before then).
 *
 * Collection Fee and Other Fee are NOT computed here — confirmed (per the same legacy tool's
 * `txtCollectionFee`/`txtotherfee` manual text boxes) to be staff-entered per generation, so the
 * caller supplies them directly when persisting/merging (see `GenerateStatementOfAccountUseCase`).
 */
export class StatementOfAccountCalculator {
  static calculate(
    installments: RepaymentInstallment[],
    contractualRate: Percentage | undefined,
    penaltyAsOfDate: Date,
    accruedInterestAsOfDate: Date,
  ): StatementOfAccountFigures {
    const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const lastInstallment = sorted[sorted.length - 1];

    const outstandingPrincipal = (i: RepaymentInstallment) => i.due.principal.subtract(i.paid.principal);
    const outstandingInterest = (i: RepaymentInstallment) => i.due.interest.subtract(i.paid.interest);
    const outstandingBase = (i: RepaymentInstallment) => outstandingPrincipal(i).add(outstandingInterest(i));

    let pastDuePrincipal = Money.ZERO;
    let pastDueInterest = Money.ZERO;
    let pastDuePenalty = Money.ZERO;

    for (const installment of sorted) {
      if (installment.dueDate.getTime() > penaltyAsOfDate.getTime()) continue; // not yet due as of the chosen date
      const unpaidPrincipal = outstandingPrincipal(installment);
      const unpaidInterest = outstandingInterest(installment);
      const unpaidBase = unpaidPrincipal.add(unpaidInterest);
      if (!unpaidBase.isPositive()) continue; // already fully settled as of this date

      if (unpaidPrincipal.isPositive()) pastDuePrincipal = pastDuePrincipal.add(unpaidPrincipal);
      if (unpaidInterest.isPositive()) pastDueInterest = pastDueInterest.add(unpaidInterest);

      const daysLate = daysBetween(installment.dueDate, penaltyAsOfDate);
      if (daysLate > 0) {
        // Penalty = unpaidBase x daysLate x (10% / 30) - flat legacy formula, confirmed 2026-07-19.
        const rowPenalty = Money.of(
          unpaidBase.toDecimal().times(daysLate).times('0.1').dividedBy(30).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        );
        pastDuePenalty = pastDuePenalty.add(rowPenalty);
      }
    }

    const totalPastDue = pastDuePrincipal.add(pastDueInterest).add(pastDuePenalty);

    const currentInstallment = sorted.find(
      (i) => i.dueDate.getTime() > penaltyAsOfDate.getTime() && outstandingBase(i).isPositive(),
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
