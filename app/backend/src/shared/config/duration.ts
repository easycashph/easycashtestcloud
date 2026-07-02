/**
 * Audit finding H-01: `env.JWT_REFRESH_TTL` (e.g. "7d") was validated as a
 * string but never actually parsed/used anywhere — refresh-token lifetime
 * was hardcoded in the use cases instead. Refresh tokens are opaque random
 * strings, not JWTs (Milestone 6 plan §3), so `jsonwebtoken`'s internal
 * duration parser isn't available for them; rather than add a new
 * dependency for this narrow, well-defined need, this is a small local
 * parser covering exactly the units we document and use.
 */
const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Returns null (rather than throwing) so callers can produce a clear, fail-fast config error. */
export function parseDurationMs(input: string): number | null {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, amount, unit] = match;
  // `noUncheckedIndexedAccess` correctly flags that capture groups are
  // typed as possibly-undefined even though DURATION_PATTERN guarantees
  // both groups matched whenever `match` is non-null. Guard explicitly
  // rather than asserting, keeping the strictness setting meaningful.
  if (amount === undefined || unit === undefined) {
    return null;
  }
  const msPerUnit = UNIT_TO_MS[unit];
  if (msPerUnit === undefined) {
    return null;
  }
  return Number(amount) * msPerUnit;
}
