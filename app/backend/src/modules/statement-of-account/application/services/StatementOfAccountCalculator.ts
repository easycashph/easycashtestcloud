import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';

export interface RemainingScheduleRow {
  dueDate: Date;
  principal: Money;
  interest: Money;
  totalDue: Money;
}

export interface StatementOfAccountFigures {
  /** Total due on the next not-yet-due installment (PENDING/PARTIALLY_PAID, due date in the future). */
  currentAmortizationDue: Money;
  pastDuePrincipal: Money;
  pastDueInterest: Money;
  pastDuePenalty: Money;
  /** Principal + Interest + Penalty past due — the base the Accrued Interest formula multiplies against. */
  totalPastDue: Money;
  accruedInterest: Money;
  /** Unpaid installments, oldest first — the "Remaining Amortization" table. */
  remainingSchedule: RemainingScheduleRow[];
}

/** Effective per-installment penalty owed as of `asOfDate` — mirrors `RepaymentInstallmentPresenter`'s
 * "override wins, else live ADR-050 projection for an open prospective-loan installment, else the
 * frozen due.penalty" precedence, so an SOA never disagrees with what the Loan Detail page shows. */
function effectivePenalty(
  installment: RepaymentInstallment,
  penaltyContext: PenaltyComputationContext | undefined,
  asOfDate: Date,
): Money {
  if (installment.penaltyOverride) return installment.penaltyOverride.amount;
  if (penaltyContext?.isProspectiveLoan && installment.status !== 'PAID') {
    return resolveComputedPenalty(installment, penaltyContext, asOfDate);
  }
  return installment.due.penalty;
}

/** Whole days from `from` to `to` (>= 0) — calendar-day difference, not a 24h-multiple wall-clock diff. */
function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24)));
}

/**
 * Statement of Account figures — sourced from the user's own legacy Excel/VBA tool
 * (`legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`, `vbaProject.bin`'s "NEW ACCRUED INTEREST
 * FORMULA ENGINE"), confirmed directly with the user (2026-07-19) rather than invented:
 *
 *   Accrued Interest = (Total Past Due [Principal + Interest + Penalty] x Contractual Rate) / 30 x Days Late
 *
 * where Days Late = whole days from the Maturity Date (last installment's due date) to
 * `accruedInterestAsOfDate`, clamped to 0 when that date has not yet reached maturity (no accrual
 * before then).
 *
 * `penaltyAsOfDate` and `accruedInterestAsOfDate` are two DELIBERATELY SEPARATE, manually-entered
 * dates (2026-07-19, user request, matching the legacy tool's own UI — its "Calculate Penalties"
 * and "Calculate Accrued" sections each have their own "To Date" field) — staff can check the
 * Penalty figure as of one date and the Accrued Interest figure as of a different date before
 * generating, rather than being forced to share a single "as of" date for both.
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
    penaltyContext: PenaltyComputationContext | undefined,
  ): StatementOfAccountFigures {
    const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const unpaid = sorted.filter((i) => i.status !== 'PAID');
    const lateInstallments = sorted.filter((i) => i.status === 'LATE');
    const lastInstallment = sorted[sorted.length - 1];

    const outstandingPrincipal = (i: RepaymentInstallment) => i.due.principal.subtract(i.paid.principal);
    const outstandingInterest = (i: RepaymentInstallment) => i.due.interest.subtract(i.paid.interest);

    const pastDuePrincipal = lateInstallments.reduce((sum, i) => sum.add(outstandingPrincipal(i)), Money.ZERO);
    const pastDueInterest = lateInstallments.reduce((sum, i) => sum.add(outstandingInterest(i)), Money.ZERO);
    const pastDuePenalty = lateInstallments.reduce((sum, i) => sum.add(effectivePenalty(i, penaltyContext, penaltyAsOfDate)), Money.ZERO);
    const totalPastDue = pastDuePrincipal.add(pastDueInterest).add(pastDuePenalty);

    // "Current Amortization Due" = the next installment not yet past due (the first non-LATE,
    // unpaid one in schedule order) — none if every remaining installment is already LATE.
    const currentInstallment = unpaid.find((i) => i.status !== 'LATE');
    const currentAmortizationDue = currentInstallment
      ? currentInstallment.due.principal
          .add(currentInstallment.due.interest)
          .subtract(currentInstallment.paid.principal)
          .subtract(currentInstallment.paid.interest)
      : Money.ZERO;

    let accruedInterest = Money.ZERO;
    if (lastInstallment && contractualRate && !contractualRate.isZero() && !totalPastDue.isZero()) {
      const daysLate = daysBetween(lastInstallment.dueDate, accruedInterestAsOfDate);
      if (daysLate > 0) {
        const dailyBase = totalPastDue.toDecimal().times(contractualRate.asFraction()).dividedBy(30);
        accruedInterest = Money.of(dailyBase.times(daysLate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
      }
    }

    const remainingSchedule: RemainingScheduleRow[] = unpaid.map((i) => ({
      dueDate: i.dueDate,
      principal: outstandingPrincipal(i),
      interest: outstandingInterest(i),
      totalDue: outstandingPrincipal(i).add(outstandingInterest(i)),
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
