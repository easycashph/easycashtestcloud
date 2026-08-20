import { Decimal } from 'decimal.js';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { resolveComputedPenalty, type PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import { manilaDaysBetween } from '@shared/domain/manilaTime';
import type { SoaPenaltyMode } from '../../domain/GeneratedStatementOfAccount';

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
 * **Penalty** — 2026-08-12 (user-confirmed) replaced the previous shared-date-range formula with
 * two explicit modes, recorded on the statement as `penaltyMode` so any past SOA can be explained
 * and reproduced:
 *
 * - `RECORDED` (the default): each installment's penalty is whatever the Repayment Schedule itself
 *   shows — `resolveComputedPenalty`, i.e. the frozen SDevTech snapshot for a migrated loan and the
 *   live ADR-050 figure for one originated here. Schedule and SOA therefore agree by construction
 *   for BOTH loan types (the long-standing goal noted in the 2026-07-28 addendum below, previously
 *   only true for prospective loans), and staff enter no penalty dates at all.
 *
 * - `COMPUTED`: keeps every recorded figure untouched and fills in ONLY the installments that have
 *   none, over a staff-entered range — for the ~2% of migrated loans where SDevTech never recorded
 *   any penalty. Per qualifying installment:
 *
 *     (unpaid Principal + Interest) x Days(max(dueDate, penaltyFromDate), penaltyCutoff) x (rate / 30)
 *
 *   Days are counted from the installment's OWN due date (or the staff "from" date, whichever is
 *   later) rather than one shared count, so an installment that was not yet overdue can never be
 *   charged a full period. `penaltyCutoff` is min(as-of date, the loan's maturity date) — penalty
 *   stops accruing at maturity, after which it is INTEREST that continues (see Accrued Interest
 *   below), never more penalty.
 *
 *   `penaltyRecomputeAll` (2026-08-21, user-reported via SML-MAX_A3F8O): an optional sibling flag,
 *   `COMPUTED`-only. Normal `COMPUTED` only fills a BLANK (zero-recorded) installment - useless for
 *   a migrated account whose recorded penalty is itself wrong (see `MANUAL`'s "years of
 *   post-maturity accrual" note) but non-zero, since there is nothing "missing" to fill. When true,
 *   the formula above runs for EVERY qualifying installment regardless of what is recorded,
 *   replacing it outright rather than only patching gaps.
 *
 * - `MANUAL`: staff type the Past Due Penalty themselves and a reason is required. For the
 *   long-defaulted migrated accounts whose recorded penalty includes years of post-maturity
 *   accrual the business no longer charges (681 loans carry ~₱19.3M of it on their final
 *   installment alone, and ~₱43.2M more sits partly-post-maturity on earlier installments). Those
 *   are settled case by case; SDevTech's own accrual formula could not be derived from the dump,
 *   so an automatic figure would be a guess dressed up as a calculation. The statement records
 *   both the amount and the reason so it can be explained against the schedule it disagrees with.
 *
 * `rate` is 5%/month if the LOAN's own `principalAmount` <= ₱10,000, else 10%/month — the same
 * whole-loan basis ADR-050/`CurrentPenaltyResolver.resolvePenaltyRatePercent` already uses
 * everywhere else, not a per-installment balance. (2026-08-21, user-reported via SML-MAX_A3F8O:
 * this used to check each installment's own unpaid Principal + Interest instead, which disagreed
 * with ADR-050 - a partially-paid installment on a ₱120,000 loan could read as "small balance" and
 * get the 5% rate just because what was LEFT on that one installment happened to be small, even
 * though the loan itself is nowhere near ₱10,000. Fixed to match the canonical rule.) Flat,
 * non-compounding, no grace period, matching the legacy tool's own flat-rate mechanics otherwise.
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
export interface StatementOfAccountCalculatorInput {
  installments: RepaymentInstallment[];
  contractualRate: Percentage | undefined;
  penaltyMode: SoaPenaltyMode;
  /** `COMPUTED` only — ignored entirely under `RECORDED` and `MANUAL`. */
  penaltyFromDate?: Date | undefined;
  penaltyToDate?: Date | undefined;
  /** `COMPUTED` only — see this class's own doc comment for what it changes. */
  penaltyRecomputeAll?: boolean | undefined;
  /** `MANUAL` only — the figure staff typed, used verbatim as the whole Past Due Penalty. */
  manualPenaltyAmount?: Money | undefined;
  accruedInterestAsOfDate: Date;
  /** Required for BOTH loan types now: `resolveComputedPenalty` uses `isProspectiveLoan` to decide
   * between the live ADR-050 figure and the migrated loan's frozen `due.penalty` snapshot. */
  penaltyContext: PenaltyComputationContext;
}

export class StatementOfAccountCalculator {
  static calculate(input: StatementOfAccountCalculatorInput): StatementOfAccountFigures {
    const {
      installments,
      contractualRate,
      penaltyMode,
      penaltyFromDate,
      penaltyToDate,
      penaltyRecomputeAll,
      manualPenaltyAmount,
      accruedInterestAsOfDate,
      penaltyContext,
    } = input;
    const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const lastInstallment = sorted[sorted.length - 1];

    const outstandingPrincipal = (i: RepaymentInstallment) => i.due.principal.subtract(i.paid.principal);
    const outstandingInterest = (i: RepaymentInstallment) => i.due.interest.subtract(i.paid.interest);
    const outstandingBase = (i: RepaymentInstallment) => outstandingPrincipal(i).add(outstandingInterest(i));

    // The date every bucket is evaluated against. `COMPUTED` keeps using the staff-entered penalty
    // "to" date (unchanged behaviour); `RECORDED` asks for no penalty dates at all, so it falls
    // back to the one date staff still enters — keeping a single coherent "as of" for the whole
    // statement rather than silently switching to real-now.
    const asOfDate = (penaltyMode === 'COMPUTED' ? penaltyToDate : undefined) ?? accruedInterestAsOfDate;

    // 2026-08-12 (user-confirmed): penalty never accrues past the loan's own maturity date — past
    // it, what continues to accrue is INTEREST (the Accrued Interest section below), not penalty.
    // Same cap `CurrentPenaltyResolver` already applies to the live figure; the manual date-range
    // path never honoured it, which is what let an installment sitting ON its maturity date be
    // charged a full period of penalty.
    const penaltyCutoff =
      asOfDate.getTime() > penaltyContext.maturityDate.getTime() ? penaltyContext.maturityDate : asOfDate;

    let pastDuePrincipal = Money.ZERO;
    let pastDueInterest = Money.ZERO;
    let pastDuePenalty = Money.ZERO;

    for (const installment of sorted) {
      if (installment.dueDate.getTime() > asOfDate.getTime()) continue; // not yet due as of the chosen date
      const unpaidPrincipal = outstandingPrincipal(installment);
      const unpaidInterest = outstandingInterest(installment);
      const unpaidBase = unpaidPrincipal.add(unpaidInterest);
      if (!unpaidBase.isPositive()) continue; // already fully settled as of this date

      if (unpaidPrincipal.isPositive()) pastDuePrincipal = pastDuePrincipal.add(unpaidPrincipal);
      if (unpaidInterest.isPositive()) pastDueInterest = pastDueInterest.add(unpaidInterest);

      // MANUAL replaces the whole Past Due Penalty with the staff-typed figure (added after the
      // loop), so no per-installment penalty is accumulated here at all.
      if (penaltyMode === 'MANUAL') continue;

      // What the Repayment Schedule itself shows for this installment: the frozen SDevTech snapshot
      // for a migrated loan, the live ADR-050 figure for one originated here.
      const recorded = resolveComputedPenalty(installment, penaltyContext, penaltyCutoff);

      // 2026-08-21 (user-reported via SML-MAX_A3F8O): `penaltyRecomputeAll` skips the
      // recorded.isPositive() short-circuit below, so the date-range formula runs even for an
      // installment that already has a (possibly wrong) nonzero recorded penalty.
      if (penaltyMode === 'RECORDED' || (!penaltyRecomputeAll && (recorded.isPositive() || !penaltyFromDate))) {
        pastDuePenalty = pastDuePenalty.add(recorded);
        continue;
      }

      // COMPUTED - either this installment has no penalty on record, or penaltyRecomputeAll forces
      // every installment through this formula regardless. Counted from its OWN due date (or the
      // staff "from" date, whichever is later) up to the cutoff, so an installment that was not yet
      // overdue can never be charged a full period.
      if (!penaltyFromDate) continue;
      const from = installment.dueDate.getTime() > penaltyFromDate.getTime() ? installment.dueDate : penaltyFromDate;
      const days = manilaDaysBetween(from, penaltyCutoff);
      if (days <= 0) continue;
      // 2026-08-21 (user-reported): whole-loan basis, not this installment's own unpaid balance -
      // see this file's own doc comment above.
      const rate = penaltyContext.principalAmount.greaterThan(SMALL_BALANCE_THRESHOLD) ? STANDARD_RATE : SMALL_BALANCE_RATE;
      pastDuePenalty = pastDuePenalty.add(
        Money.of(unpaidBase.toDecimal().times(days).times(rate).dividedBy(30).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)),
      );
    }

    if (penaltyMode === 'MANUAL') {
      pastDuePenalty = manualPenaltyAmount ?? Money.ZERO;
    }

    const totalPastDue = pastDuePrincipal.add(pastDueInterest).add(pastDuePenalty);

    const currentInstallment = sorted.find(
      (i) => i.dueDate.getTime() > asOfDate.getTime() && outstandingBase(i).isPositive(),
    );
    const currentAmortizationDue = currentInstallment ? outstandingBase(currentInstallment) : Money.ZERO;

    let accruedInterest = Money.ZERO;
    if (lastInstallment && contractualRate && !contractualRate.isZero() && totalPastDue.isPositive()) {
      const daysLate = manilaDaysBetween(lastInstallment.dueDate, accruedInterestAsOfDate);
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
