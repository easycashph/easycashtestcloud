import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Matches a standalone Roman numeral token (I, II, III, IV ... up to a few thousand) - used to
// keep barangay/subdivision/phase numbering (e.g. "Barangay III", "Phase IV") fully uppercase
// instead of being title-cased into "Iii"/"Iv" by `toProperCase` below.
const ROMAN_NUMERAL_RE = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;

// Known address abbreviations (PSGC region names, etc.) that must stay fully uppercase rather
// than being title-cased - add more here as they turn up (display-only allowlist, not exhaustive).
const ADDRESS_ABBREVIATIONS = new Set(['NCR', 'CAR', 'ARMM', 'BARMM']);

/**
 * Proper-cases a name, e.g. address/region/province/city/barangay text - mirrors app/frontend's
 * own toProperCase() exactly (the PSGC reference data is shared by both apps via the backend).
 */
export function toProperCase(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return value ? String(value) : '';
  return value.replace(/[\p{L}']+/gu, (word) => {
    if (ADDRESS_ABBREVIATIONS.has(word.toUpperCase()) || ROMAN_NUMERAL_RE.test(word)) {
      return word.toUpperCase();
    }
    return word.toLowerCase().replace(/(^|')\p{L}/gu, (c) => c.toUpperCase());
  });
}
