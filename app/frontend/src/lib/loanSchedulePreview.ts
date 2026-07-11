/**
 * PREVIEW-ONLY reimplementation of `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §1–§2
 * (Declining-Balance Interest Per Period, Level Payment Amortization) and
 * `ActivateLoanUseCase`'s `addMonths()` due-date derivation. This exists purely so the Create
 * Loan Account screen can show a live schedule preview before submitting — it is NOT the real
 * `AmortizationScheduleGenerator` (`app/backend/src/shared/domain/calculation/
 * AmortizationScheduleGenerator.ts`) and must not be treated as financially authoritative. The
 * real engine is what actually generates the persisted schedule, at Activate time.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Calendar-month addition with end-of-month clamping (e.g. Jan 31 + 1 month -> Feb 28/29) —
 * mirrors `ActivateLoanUseCase.addMonths()` exactly, operating in UTC to match the backend's own
 * date handling.
 */
export function addMonths(date: Date, months: number): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

export interface SchedulePreviewEntry {
  installmentNumber: number;
  dueDate: Date;
  beginningPrincipal: number;
  interestPortion: number;
  principalPortion: number;
  payment: number;
  endingPrincipal: number;
}

export interface SchedulePreviewResult {
  monthlyPayment: number;
  schedule: SchedulePreviewEntry[];
}

/**
 * `principal`/`monthlyRate` as plain numbers (percent as e.g. 4.85, not 0.0485) — matches the
 * form inputs this feeds from. Returns `null` for invalid input (mirrors the backend's own
 * `InvalidAmortizationInputError` validation rules) rather than producing garbage.
 */
export function previewLoanSchedule(
  principal: number,
  monthlyRatePercent: number,
  installmentCount: number,
  firstRepaymentDate: Date,
): SchedulePreviewResult | null {
  if (!Number.isInteger(installmentCount) || installmentCount <= 0) return null;
  if (!(monthlyRatePercent > 0) || !(principal > 0)) return null;

  const rate = monthlyRatePercent / 100;
  const monthlyPayment = round2((rate * principal) / (1 - (1 + rate) ** -installmentCount));

  const schedule: SchedulePreviewEntry[] = [];
  let beginningPrincipal = principal;

  for (let installmentNumber = 1; installmentNumber <= installmentCount; installmentNumber++) {
    const interestPortion = round2(beginningPrincipal * rate);
    const isFinal = installmentNumber === installmentCount;
    // ROUND_REMAINDER_INTO_LAST_REPAYMENT (CALCULATION_ENGINE_SPEC.md §7): the final
    // installment's principal is the exact remaining balance, guaranteeing endingPrincipal
    // lands on exactly 0 — matches AmortizationScheduleGenerator, not a separate rule.
    const principalPortion = isFinal ? beginningPrincipal : round2(monthlyPayment - interestPortion);
    const payment = isFinal ? round2(interestPortion + principalPortion) : monthlyPayment;
    const endingPrincipal = round2(beginningPrincipal - principalPortion);

    schedule.push({
      installmentNumber,
      dueDate: addMonths(firstRepaymentDate, installmentNumber - 1),
      beginningPrincipal,
      interestPortion,
      principalPortion,
      payment,
      endingPrincipal,
    });

    beginningPrincipal = endingPrincipal;
  }

  return { monthlyPayment, schedule };
}
