import { Prisma } from '@prisma/client';
import { InvalidPercentageError } from './errors/FinancialDomainErrors';

const MAX_DECIMAL_PLACES = 3;
// Mirrors the schema's `Decimal(6,3)` column precision used for every
// rate/percentage field (LoanProductVersion.defaultInterestRate,
// PenaltyRule.ratePercent, FeeRule.percentage, etc.) — 3 integer digits +
// 3 decimal digits, so the maximum representable magnitude is 999.999.
const MAX_MAGNITUDE = 1000;

/**
 * Value object for a rate/percentage (e.g. "12.5" meaning 12.5%). Kept as a
 * distinct type from Money so a rate can never be silently added to an
 * amount by an arithmetic mistake.
 *
 * Pure, deterministic, framework-free (Clean Architecture: domain layer has
 * no outward dependencies — Prisma is used here only for its bundled
 * `Decimal` arithmetic type, not for any database access).
 *
 * Construction throws InvalidPercentageError on malformed input (Milestone
 * 7 design review, final decision) — this is a type-invariant violation,
 * not a business-rule outcome, so it is thrown rather than returned as a
 * Result. Every method below is total: given a validly-constructed
 * Percentage, none of them can fail.
 */
export class Percentage {
  private constructor(private readonly decimal: Prisma.Decimal) {}

  static of(value: Prisma.Decimal.Value): Percentage {
    const decimal = new Prisma.Decimal(value);

    if (!decimal.isFinite()) {
      throw new InvalidPercentageError('value must be a finite number.');
    }
    if (decimal.decimalPlaces() > MAX_DECIMAL_PLACES) {
      throw new InvalidPercentageError(
        `at most ${MAX_DECIMAL_PLACES} decimal places are allowed (schema precision Decimal(6,3)).`,
      );
    }
    if (decimal.abs().greaterThanOrEqualTo(MAX_MAGNITUDE)) {
      throw new InvalidPercentageError(`magnitude must be less than ${MAX_MAGNITUDE} (schema precision Decimal(6,3)).`);
    }

    return new Percentage(decimal);
  }

  static readonly ZERO = Percentage.of(0);

  /** As a fraction (e.g. 12.5% -> 0.125) — the form needed for multiplying a Money amount. */
  asFraction(): Prisma.Decimal {
    return this.decimal.dividedBy(100);
  }

  isZero(): boolean {
    return this.decimal.isZero();
  }

  isNegative(): boolean {
    return this.decimal.isNegative();
  }

  equals(other: Percentage): boolean {
    return this.decimal.equals(other.decimal);
  }

  /** Raw decimal value (e.g. 12.5 for "12.5%") — for persistence/display only, never re-parsed. */
  toDecimal(): Prisma.Decimal {
    return this.decimal;
  }

  toString(): string {
    return this.decimal.toFixed(MAX_DECIMAL_PLACES);
  }
}
