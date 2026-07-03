import type { Money } from '@shared/domain/Money';
import { InvalidPaymentAllocationInputError } from './errors/CalculationDomainErrors';

export interface PaymentAllocationResult {
  feesApplied: Money;
  penaltyApplied: Money;
  interestApplied: Money;
  principalApplied: Money;
  /** Unapplied excess after every tier is exhausted — see CALC-SPEC §11 (Overpayment Handling), `STATUS: UNRESOLVED`. Surfaced here, never discarded or given an invented disposition. */
  remainder: Money;
}

/**
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §5 — Payment Allocation
 * Order. `STATUS: CONFIRMED (contractual text)` — sourced from
 * `201 Loan Docs PN Template.docx` (Promissory Note), clause 4: "Any
 * payments made by me/us shall be applied first to collection charges and
 * other fees, then penalties, interest, and principal in that order."
 * Penalty-before-both and interest-before-principal are additionally
 * confirmed transactionally — see
 * `docs/Architecture/ADR-009-payment-allocation-order.md` §2 for the full,
 * per-tier evidence and confidence breakdown.
 *
 * Deliberately a plain, single-purpose calculator, not a policy/strategy
 * interface — per `docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`
 * Decision Log #15: there is currently exactly one evidenced allocation
 * order, and `ADR-009` §7 records per-product configurability as
 * unresolved, not confirmed as a future requirement. Introducing an
 * abstraction for a single implementation, in anticipation of a question
 * that isn't even confirmed to resolve "yes," was explicitly rejected
 * during roadmap revision.
 *
 * Allocates a single payment against a single installment's four due
 * amounts, in order: fees, penalty, interest, principal. Each tier is
 * filled completely (up to what remains of the payment) before any amount
 * moves to the next tier. Reuses `Money.subtract()`/`.lessThan()` for all
 * arithmetic/comparison — no rounding or arithmetic is duplicated from
 * `Money`, since every quantity here is already at money scale and every
 * operation (subtraction, comparison) is exact.
 */
export class PaymentAllocationCalculator {
  static calculate(
    paymentAmount: Money,
    feesDue: Money,
    penaltyDue: Money,
    interestDue: Money,
    principalDue: Money,
  ): PaymentAllocationResult {
    if (paymentAmount.isNegative()) {
      throw new InvalidPaymentAllocationInputError('paymentAmount must not be negative.');
    }
    for (const [label, due] of [
      ['feesDue', feesDue],
      ['penaltyDue', penaltyDue],
      ['interestDue', interestDue],
      ['principalDue', principalDue],
    ] as const) {
      if (due.isNegative()) {
        throw new InvalidPaymentAllocationInputError(`${label} must not be negative.`);
      }
    }

    let remaining = paymentAmount;

    const feesApplied = minMoney(remaining, feesDue);
    remaining = remaining.subtract(feesApplied);

    const penaltyApplied = minMoney(remaining, penaltyDue);
    remaining = remaining.subtract(penaltyApplied);

    const interestApplied = minMoney(remaining, interestDue);
    remaining = remaining.subtract(interestApplied);

    const principalApplied = minMoney(remaining, principalDue);
    remaining = remaining.subtract(principalApplied);

    return { feesApplied, penaltyApplied, interestApplied, principalApplied, remainder: remaining };
  }
}

function minMoney(a: Money, b: Money): Money {
  return a.lessThan(b) ? a : b;
}
