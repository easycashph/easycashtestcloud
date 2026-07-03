import { Prisma } from '@prisma/client';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import { DecliningBalanceInterestCalculator } from './DecliningBalanceInterestCalculator';
import { InvalidAmortizationInputError } from './errors/CalculationDomainErrors';

export interface AmortizationScheduleEntry {
  installmentNumber: number;
  beginningPrincipal: Money;
  interestPortion: Money;
  principalPortion: Money;
  payment: Money;
  endingPrincipal: Money;
}

export interface AmortizationScheduleResult {
  monthlyPayment: Money;
  schedule: AmortizationScheduleEntry[];
}

/**
 * `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §2 — Level Payment
 * Amortization (`PMT`). `STATUS: CONFIRMED`, verified against the
 * `Sample Computation Sheet updated.xlsx` worked example
 * (`docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §1–§2) and
 * an independent from-scratch reimplementation matched against 9 real
 * released loans.
 *
 * Formula (exactly as documented, not invented):
 * `MonthlyPayment = (MonthlyContractualRate × Principal) /
 * (1 − (1 + MonthlyContractualRate)^(−NumberOfInstallments))`, then per
 * period `n`: `Interest_n = Balance_(n-1) × MonthlyContractualRate`,
 * `Principal_n = MonthlyPayment − Interest_n`,
 * `Balance_n = Balance_(n-1) − Principal_n`.
 *
 * `Money`/`Percentage` have no division or exponentiation operations —
 * per `ADR-010` §7 ("PMT... is not a simple multiply/allocate operation
 * like the value objects' existing methods... will need a new, dedicated
 * calculation service, not an addition to Money itself"), this generator
 * operates on the raw `Prisma.Decimal` beneath `Money`/`Percentage` only
 * for the operations they don't provide (division, `.pow()`), and
 * otherwise reuses `Money`'s own arithmetic (`.subtract()`) and the
 * declining-balance interest calculator (§1) rather than duplicating any
 * of it. The monthly payment is rounded exactly once, at computation time,
 * using the same half-up-to-`Decimal(14,2)` convention `Money.multiply()`
 * already documents as this project's fixed default for a single
 * arithmetic step (per the spec's "Rounding" section) — not a new
 * rounding rule.
 *
 * Known, spec-acknowledged limitation, deliberately NOT addressed here:
 * per-period half-up rounding of `Interest_n` can leave the final period's
 * `endingPrincipal` a few centavos away from exactly zero (verified
 * empirically: the spec's own 80,953.71 / 3.7% / 8-installment worked
 * example ends at −0.03, not 0.00, under this exact formula). Absorbing
 * that residual into the final installment is
 * `LoanProductVersion.roundingMethod = ROUND_REMAINDER_INTO_LAST_REPAYMENT`
 * — `CALCULATION_ENGINE_SPEC.md` §7, explicitly `STATUS: UNRESOLVED` and
 * out of scope for this checkpoint. This generator implements only the
 * confirmed §2 formula; it does not invent a remainder-allocation rule.
 */
export class AmortizationScheduleGenerator {
  static generate(principal: Money, monthlyContractualRate: Percentage, installmentCount: number): AmortizationScheduleResult {
    if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
      throw new InvalidAmortizationInputError('installmentCount must be a positive integer.');
    }
    if (monthlyContractualRate.isZero() || monthlyContractualRate.isNegative()) {
      // CALC-SPEC §2 Validation Rules: a zero rate divides by zero in the
      // formula's denominator (`1 - (1+0)^-n = 0`); the degenerate-case
      // formula that would be needed instead is explicitly
      // `STATUS: UNRESOLVED`, not evidenced anywhere examined — rejected
      // here rather than guessed at.
      throw new InvalidAmortizationInputError('monthlyContractualRate must be greater than zero.');
    }

    const monthlyPayment = calculateMonthlyPayment(principal, monthlyContractualRate, installmentCount);

    const schedule: AmortizationScheduleEntry[] = [];
    let beginningPrincipal = principal;
    for (let installmentNumber = 1; installmentNumber <= installmentCount; installmentNumber++) {
      const interestPortion = DecliningBalanceInterestCalculator.calculate(beginningPrincipal, monthlyContractualRate);
      const principalPortion = monthlyPayment.subtract(interestPortion);
      const endingPrincipal = beginningPrincipal.subtract(principalPortion);

      schedule.push({
        installmentNumber,
        beginningPrincipal,
        interestPortion,
        principalPortion,
        payment: monthlyPayment,
        endingPrincipal,
      });

      beginningPrincipal = endingPrincipal;
    }

    return { monthlyPayment, schedule };
  }
}

function calculateMonthlyPayment(principal: Money, monthlyContractualRate: Percentage, installmentCount: number): Money {
  const rate = monthlyContractualRate.asFraction();
  const numerator = rate.times(principal.toDecimal());
  const denominator = new Prisma.Decimal(1).minus(new Prisma.Decimal(1).plus(rate).pow(-installmentCount));
  const rawPayment = numerator.dividedBy(denominator);
  return Money.of(rawPayment.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
}
