import { z } from 'zod';

/**
 * Milestone 8.1 remediation (audit finding H-2): a plain `z.string().min(1)`
 * lets a syntactically-malformed value (e.g. "abc") reach `Money.of()`/
 * `Percentage.of()`, whose first statement is `new Prisma.Decimal(value)` —
 * unparseable input throws decimal.js's own `Error`, not a `DomainError`,
 * so it falls through `errorHandler`'s generic 500 branch instead of
 * returning a clean 400.
 *
 * This is a SHAPE/FORMAT check only (plain decimal notation: optional
 * leading `-`, digits, optional `.digits`) — it deliberately does not
 * enforce scale or magnitude (that stays `Money`/`Percentage`'s job, via
 * `InvalidMoneyError`/`InvalidPercentageError`, once a well-formed string
 * reaches them). No redesign of either class; this only moves the
 * "is this even a number" check to the HTTP boundary, where Zod's other
 * shape/type validation already lives.
 */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

export const decimalStringSchema = z
  .string()
  .min(1)
  .regex(DECIMAL_PATTERN, 'must be a valid decimal number (e.g. "1000.00")');
