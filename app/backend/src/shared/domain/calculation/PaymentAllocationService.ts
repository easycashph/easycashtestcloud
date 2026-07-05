import type { Money } from '@shared/domain/Money';
import { PaymentAllocationCalculator } from './PaymentAllocationCalculator';
import { InvalidPaymentAllocationInputError } from './errors/CalculationDomainErrors';

/**
 * The minimal shape `PaymentAllocationService` needs from "an
 * installment." Deliberately a structural interface, not an import of
 * `modules/repayment/domain/RepaymentInstallment` — this checkpoint stays
 * independent of that module (and of the not-yet-built checkpoints that
 * will wire this service against real aggregates), and TypeScript's
 * structural typing means any object with this shape (including a real
 * `RepaymentInstallment`'s own getters) satisfies it without a direct
 * dependency in either direction.
 *
 * The caller is responsible for supplying installments already sorted in
 * the order they should be paid; this service does not re-sort a
 * caller-supplied order. Per `ADR-009-payment-allocation-order.md` §2,
 * the only evidence gathered is "every sampled multi-installment loan's
 * payments occur in the same order as the schedule's due-date ordering"
 * (`STATUS: PARTIALLY CONFIRMED` — an observed pattern, not a proven
 * rule). What this service DOES enforce (2026-07-06 verification-pass
 * follow-up, M-6): `dueDate` is now part of this interface specifically
 * so `allocate()` can verify the caller's ordering claim rather than
 * trusting it silently — a wrong caller-supplied order would otherwise
 * misallocate a real payment with no error raised.
 */
export interface AllocatableInstallment {
  readonly id: string;
  readonly dueDate: Date;
  readonly feesDue: Money;
  readonly penaltyDue: Money;
  readonly interestDue: Money;
  readonly principalDue: Money;
}

export interface InstallmentAllocation {
  installmentId: string;
  feesApplied: Money;
  penaltyApplied: Money;
  interestApplied: Money;
  principalApplied: Money;
}

export interface CrossInstallmentAllocationResult {
  /** One entry per installment supplied, in the same order — some may be all-zero if the payment ran out before reaching them. */
  allocations: InstallmentAllocation[];
  /** Unapplied excess after every supplied installment's tiers are exhausted — see CALC-SPEC §11, `STATUS: UNRESOLVED`. Surfaced here, never discarded or given an invented disposition. */
  remainder: Money;
}

/**
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §5's "Edge Cases" note:
 * "This formula, as written, operates on a single installment's due
 * amounts; a `PaymentAllocationService`... must wrap this formula in a
 * loop across installments in due-date order" — this is that service, per
 * `docs/Architecture/ADR-042-aggregate-boundaries.md` §7 (a stateless
 * domain service, not a method on any aggregate).
 *
 * Applies one payment across multiple installments in the order supplied,
 * carrying whatever's left over (`PaymentAllocationCalculator`'s
 * `remainder`) into the next installment, until either the payment is
 * exhausted or every installment has been offered a share.
 */
export class PaymentAllocationService {
  static allocate(paymentAmount: Money, installments: readonly AllocatableInstallment[]): CrossInstallmentAllocationResult {
    if (!paymentAmount.isPositive()) {
      // CALC-SPEC §5 Validation Rules: "paymentAmount must be > 0 for a
      // normal payment... reversals/adjustments are separate
      // calculations" (§10, out of scope). This is the top-level "is this
      // a real payment at all" check; the per-installment calculator
      // below is deliberately more permissive (it must accept a
      // legitimately-zero remaining amount once the payment has already
      // been spent on earlier installments in this same loop).
      throw new InvalidPaymentAllocationInputError('paymentAmount must be greater than zero.');
    }

    for (let i = 1; i < installments.length; i++) {
      // M-6 (2026-07-06): the caller claims to supply installments in
      // due-date order (ADR-009 §2) — verify it rather than silently
      // trusting it. A strictly-earlier dueDate at a later position means
      // the caller's ordering is wrong, and continuing would misallocate
      // this payment against the wrong installments with no error.
      const previous = installments[i - 1] as AllocatableInstallment;
      const current = installments[i] as AllocatableInstallment;
      if (current.dueDate.getTime() < previous.dueDate.getTime()) {
        throw new InvalidPaymentAllocationInputError(
          `installments must be supplied in due-date order; installment "${current.id}" (due ${current.dueDate.toISOString()}) ` +
            `comes after installment "${previous.id}" (due ${previous.dueDate.toISOString()}) but has an earlier due date.`,
        );
      }
    }

    const allocations: InstallmentAllocation[] = [];
    let remaining = paymentAmount;

    for (const installment of installments) {
      const result = PaymentAllocationCalculator.calculate(
        remaining,
        installment.feesDue,
        installment.penaltyDue,
        installment.interestDue,
        installment.principalDue,
      );

      allocations.push({
        installmentId: installment.id,
        feesApplied: result.feesApplied,
        penaltyApplied: result.penaltyApplied,
        interestApplied: result.interestApplied,
        principalApplied: result.principalApplied,
      });

      remaining = result.remainder;
    }

    return { allocations, remainder: remaining };
  }
}
