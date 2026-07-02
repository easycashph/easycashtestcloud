import proxyAddr from 'proxy-addr';

/**
 * Audit finding C-02: Express's `trust proxy` setting controls how much
 * `req.ip` (and therefore express-rate-limit's default per-IP key, and
 * every `createdByIp`/audit IP field in the identity module) trusts
 * client-supplied `X-Forwarded-For` headers. Getting this wrong is
 * dangerous in both directions:
 *
 *  - Too little trust behind a real reverse proxy: every request appears
 *    to come from the proxy's own IP, so the login rate limiter becomes a
 *    single shared bucket for ALL users (one bad actor locks out
 *    everyone), and audit/forensic IP data becomes useless.
 *  - Too much trust with no real proxy in front: any client can forge
 *    `X-Forwarded-For` to spoof their IP and bypass per-IP rate limiting
 *    entirely, or pollute the audit trail with fabricated addresses.
 *
 * This must be set to match the ACTUAL deployment topology — see
 * app/README.md and `.env.example` for the values to use in each case.
 * Prefer a numeric hop count ("1") or an explicit subnet/IP list over the
 * bare "true" — "true" trusts every hop in the X-Forwarded-For chain
 * unconditionally, which is only safe if you're certain no untrusted
 * network segment sits between the client and your proxy.
 */
export function parseTrustProxy(value: string): boolean | number | string {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // Anything else is passed through as-is: Express/proxy-addr understands
  // subnet keywords ("loopback", "linklocal", "uniquelocal") and
  // comma-separated IP/CIDR lists natively.
  return trimmed;
}

/**
 * Production-readiness review finding: without this, a malformed
 * TRUST_PROXY value (e.g. a typo) wasn't caught by our own config
 * validation — it fell through to Express's internal `app.set('trust
 * proxy', ...)` call, which would throw an unrelated, unclear error from
 * the `proxy-addr`/`ipaddr.js` libraries deep in Express's boot sequence
 * instead of one of our own clear, actionable messages.
 *
 * This uses `proxy-addr.compile` directly — the EXACT function Express
 * itself calls internally for string values — so this check is guaranteed
 * to accept exactly what Express would accept, not an approximation of it
 * via a hand-rolled regex (which would be especially error-prone for
 * IPv6). Returns an error message, or null if the value is valid.
 */
export function validateTrustProxy(value: string): string | null {
  const parsed = parseTrustProxy(value);
  if (typeof parsed === 'boolean' || typeof parsed === 'number') {
    // Express handles these without ever calling proxy-addr — nothing to validate.
    return null;
  }
  try {
    // Mirrors Express's own compileTrust(): split on commas, trim each entry.
    proxyAddr.compile(parsed.split(',').map((entry) => entry.trim()));
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Invalid TRUST_PROXY value "${value}": ${message}`;
  }
}
