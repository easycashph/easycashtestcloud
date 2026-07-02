import { Prisma } from '@prisma/client';
import { InvalidMoneyError } from './errors/FinancialDomainErrors';
import type { Percentage } from './Percentage';

const SCALE = 2;
// Mirrors the schema's `Decimal(14,2)` column precision used for every
// money field (LoanAccount.principalBalance, LoanTransaction.amount,
// etc.) — 12 integer digits + 2 decimal digits.
const MAX_MAGNITUDE = new Prisma.Decimal('1e12');

/**
 * Value object for a monetary amount (implicit single currency, PHP — this
 * platform has no multi-currency requirement; see FINANCIAL_INVARIANTS.md
 * §5). Wraps Prisma's bundled `Decimal` (decimal.js) rather than a native
 * JS `number`, so monetary values never pass through floating-point
 * arithmetic anywhere in the domain layer.
 *
 * Milestone 7 design review, FINAL decisions:
 *   - Money is a Value Object.
 *   - Money methods are deterministic (pure, total functions — given
 *     well-formed inputs, none of them can fail).
 *   - Construction throws a typed DomainError (InvalidMoneyError) on
 *     invalid input.
 *   - Do NOT introduce Result<T,E> for Money.
 *
 * A negative Money value is not, by itself, invalid — overpayments,
 * advance payments, and reversals are valid business states
 * (PROJECT_RULES.md §Payments; FINANCIAL_INVARIANTS.md §3). Whether a
 * particular negative result is acceptable in a given context is a
 * business rule enforced by the domain entity/service that calls these
 * operations, never by Money itself.
 */
export class Money {
  private constructor(private readonly decimal: Prisma.Decimal) {}

  static of(value: Prisma.Decimal.Value): Money {
    const decimal = new Prisma.Decimal(value);

    if (!decimal.isFinite()) {
      throw new InvalidMoneyError('value must be a finite number.');
    }
    if (decimal.decimalPlaces() > SCALE) {
      throw new InvalidMoneyError(`at most ${SCALE} decimal places are allowed (schema precision Decimal(14,2)).`);
    }
    if (decimal.abs().greaterThanOrEqualTo(MAX_MAGNITUDE)) {
      throw new InvalidMoneyError('magnitude exceeds schema precision Decimal(14,2).');
    }

    // Normalize to exactly SCALE decimal places (e.g. "10" -> "10.00") so
    // every Money instance has a canonical decimal representation.
    return new Money(decimal.toDecimalPlaces(SCALE));
  }

  static readonly ZERO = Money.of(0);

  add(other: Money): Money {
    return Money.of(this.decimal.plus(other.decimal));
  }

  subtract(other: Money): Money {
    return Money.of(this.decimal.minus(other.decimal));
  }

  negate(): Money {
    return Money.of(this.decimal.negated());
  }

  /**
   * Applies a rate (e.g. an interest or fee Percentage) to this amount.
   * Rounds to the money scale using half-up rounding — a fixed, documented
   * arithmetic default for a single multiplication. This is distinct from
   * `LoanProductVersion.roundingMethod` (FIN-4), which governs how a
   * *remainder across multiple installments* is allocated, not how one
   * multiplication result is rounded — that policy is applied by the
   * (not-yet-built) calculation engine, not by Money itself.
   */
  multiply(rate: Percentage): Money {
    const result = this.decimal.times(rate.asFraction()).toDecimalPlaces(SCALE, Prisma.Decimal.ROUND_HALF_UP);
    return Money.of(result);
  }

  /**
   * Splits this amount into `parts` whole-cent shares that sum EXACTLY back
   * to the original amount (largest-remainder method) — never producing a
   * rounding drift. Deterministic: the first `remainder` parts (in array
   * order) each receive one extra cent, so calling this twice with the
   * same inputs always produces the same split.
   */
  allocate(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new InvalidMoneyError('allocate() requires a positive integer number of parts.');
    }

    const totalCents = this.decimal.times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const baseCents = totalCents.dividedToIntegerBy(parts);
    const remainderCents = totalCents.minus(baseCents.times(parts)).toNumber();

    return Array.from({ length: parts }, (_, index) => {
      const cents = index < remainderCents ? baseCents.plus(1) : baseCents;
      return Money.of(cents.dividedBy(100));
    });
  }

  isZero(): boolean {
    return this.decimal.isZero();
  }

  isNegative(): boolean {
    return this.decimal.isNegative();
  }

  isPositive(): boolean {
    return this.decimal.isPositive() && !this.decimal.isZero();
  }

  equals(other: Money): boolean {
    return this.decimal.equals(other.decimal);
  }

  greaterThan(other: Money): boolean {
    return this.decimal.greaterThan(other.decimal);
  }

  lessThan(other: Money): boolean {
    return this.decimal.lessThan(other.decimal);
  }

  /** Raw decimal value — for persistence layer use only (writing a Prisma `Decimal` field). */
  toDecimal(): Prisma.Decimal {
    return this.decimal;
  }

  /**
   * For display/logging only — never re-parse this or use it for further
   * arithmetic (that would reintroduce floating-point error).
   */
  toString(): string {
    return this.decimal.toFixed(SCALE);
  }
}
