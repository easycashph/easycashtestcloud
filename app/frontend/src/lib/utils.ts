import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `crypto.randomUUID()` only exists in secure contexts (HTTPS, or `localhost`) - it's `undefined`
 * when the app is opened over plain `http://<lan-ip>:5173` (e.g. a phone on the same office WiFi,
 * or a PC reached by its LAN IP instead of `localhost`), which throws before any request is even
 * sent. Idempotency keys don't need cryptographic randomness, just uniqueness, so a plain
 * Math.random()-based v4 fallback is fine here. */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** PHP currency formatting, used throughout the app for real money figures. */
export function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Date AND time - used where the exact moment matters, e.g. Activity Logs (every entry must be timestamped, not just dated). */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Recharts' `Tooltip formatter` prop accepts values that may not be plain numbers (arrays, strings, undefined) - narrow before formatting. */
export function pesoTooltipFormatter(value: unknown): string {
  return formatPeso(typeof value === 'number' ? value : Number(value ?? 0));
}

/**
 * Groups an 11-digit PH mobile number for readability, e.g. "09171234567" → "0917 123 4567".
 * Numbers are stored as plain digit strings with no formatting (see `loanApiTypes.ts`/
 * `loanApplicationApiTypes.ts`) - this is display-only, never applied to stored/submitted values.
 * Anything that isn't exactly 11 digits (missing, partial, or already-formatted input) is returned
 * as-is rather than guessing a grouping.
 */
export function formatMobileNumber(value: string | null | undefined): string {
  // Guards against non-string runtime values too (e.g. malformed AI-extraction output) - the
  // `string | null` param type is compile-time only, not enforced at runtime.
  if (!value || typeof value !== 'string') return value ? String(value) : '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

// Matches a standalone Roman numeral token (I, II, III, IV ... up to a few thousand) - used to
// keep barangay/subdivision/phase numbering (e.g. "Barangay III", "Phase IV") fully uppercase
// instead of being title-cased into "Iii"/"Iv" by `toProperCase` below.
const ROMAN_NUMERAL_RE = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;

// Known address abbreviations (PSGC region names, etc.) that must stay fully uppercase rather
// than being title-cased - add more here as they turn up (display-only allowlist, not exhaustive).
const ADDRESS_ABBREVIATIONS = new Set(['NCR', 'CAR', 'ARMM', 'BARMM']);

/**
 * Trims trailing zeros from a percentage string as stored/returned by the backend (always a fixed
 * 3 decimals, e.g. "2.520", matching the `Decimal(6,3)` schema column) - "2.520" -> "2.52%",
 * "15.000" -> "15%". Display-only; the raw value is never re-parsed or recomputed here.
 */
export function formatPercentage(value: string | null | undefined): string {
  if (!value) return '-';
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return `${trimmed}%`;
}

/**
 * Proper-cases a name, e.g. address/region/province/city/barangay text - the PSGC reference data
 * and free-text address fields are stored with inconsistent casing (ALL CAPS, lowercase, mixed),
 * which reads poorly wherever displayed together. Display-only: lowercases the whole string first,
 * then capitalizes the first letter of each word (word boundary via `\w`, so hyphens/apostrophes
 * like "O'Brien" or "Dolores-San Jose" still capitalize correctly on both sides) - except Roman
 * numerals and known abbreviations (see above), which are left fully uppercase instead.
 */
export function toProperCase(value: string | null | undefined): string {
  // Guards against non-string runtime values too (e.g. malformed AI-extraction output) - the
  // `string | null` param type is compile-time only, not enforced at runtime.
  if (!value || typeof value !== 'string') return value ? String(value) : '';
  // \p{L} (any Unicode letter) rather than A-Za-z - Philippine place names commonly carry accented
  // letters (e.g. "Dasmariñas", "Parañaque"), which a plain A-Za-z match would skip over entirely,
  // leaving that letter's original casing untouched (the literal "DasmariÑAs" bug this fixed).
  return value.replace(/[\p{L}']+/gu, (word) => {
    if (ADDRESS_ABBREVIATIONS.has(word.toUpperCase()) || ROMAN_NUMERAL_RE.test(word)) {
      return word.toUpperCase();
    }
    // Capitalize at the start and after every apostrophe (e.g. "O'Brien"), lowercase elsewhere.
    return word.toLowerCase().replace(/(^|')\p{L}/gu, (c) => c.toUpperCase());
  });
}
