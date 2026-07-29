/**
 * PREVIEW-ONLY reimplementation of the display order documented in
 * `docs/Architecture/ADR-009-payment-allocation-order.md` and
 * `CALCULATION_ENGINE_SPEC.md` §5 (fees -> penalty -> interest -> principal).
 * This exists purely so the Payment Recording screen can show a live allocation preview, computed
 * client-side against the real installment amounts already loaded from the backend, before the
 * payment is actually submitted - it is NOT the real `PaymentAllocationService`
 * (`app/backend/src/shared/domain/calculation/PaymentAllocationService.ts`) and must not be
 * treated as financially authoritative. That real engine is what actually posts the payment
 * (`POST /loan-accounts/:id/payments`) and is the source of truth if this preview ever disagrees.
 */
export interface AllocationPreviewInput {
  feesDue: number;
  penaltyDue: number;
  interestDue: number;
  principalDue: number;
}

export interface AllocationPreviewResult {
  feesApplied: number;
  penaltyApplied: number;
  interestApplied: number;
  principalApplied: number;
  remainder: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function previewAllocation(paymentAmount: number, due: AllocationPreviewInput): AllocationPreviewResult {
  let remaining = Math.max(0, paymentAmount);

  const feesApplied = round2(Math.min(remaining, due.feesDue));
  remaining = round2(remaining - feesApplied);

  const penaltyApplied = round2(Math.min(remaining, due.penaltyDue));
  remaining = round2(remaining - penaltyApplied);

  const interestApplied = round2(Math.min(remaining, due.interestDue));
  remaining = round2(remaining - interestApplied);

  const principalApplied = round2(Math.min(remaining, due.principalDue));
  remaining = round2(remaining - principalApplied);

  return { feesApplied, penaltyApplied, interestApplied, principalApplied, remainder: remaining };
}

export interface InstallmentAllocationPreviewRow extends AllocationPreviewResult {
  installmentId: string;
  installmentNumber: number;
}

/**
 * Cross-installment preview, oldest-due-first (mirrors `ADR-009` §2 /
 * `ProcessPaymentUseCase`'s loop) - for display only. `installments` must
 * already be pre-sorted oldest-due-first and pre-filtered to unpaid rows;
 * this function does not sort or filter.
 */
export function previewCrossInstallmentAllocation(
  paymentAmount: number,
  installments: { id: string; installmentNumber: number; remainingDue: AllocationPreviewInput }[],
): { rows: InstallmentAllocationPreviewRow[]; remainder: number } {
  let remaining = Math.max(0, paymentAmount);
  const rows: InstallmentAllocationPreviewRow[] = [];

  for (const installment of installments) {
    if (remaining <= 0) break;
    const result = previewAllocation(remaining, installment.remainingDue);
    const applied = result.feesApplied + result.penaltyApplied + result.interestApplied + result.principalApplied;
    if (applied > 0) {
      rows.push({ installmentId: installment.id, installmentNumber: installment.installmentNumber, ...result });
    }
    remaining = result.remainder;
  }

  return { rows, remainder: round2(remaining) };
}
