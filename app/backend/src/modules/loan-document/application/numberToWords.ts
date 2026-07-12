import { Decimal } from 'decimal.js';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder] as string);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : (TENS[tens] as string));
    }
  }
  return parts.join(' ');
}

/** Whole-number part only (no decimals) — used for the integer-pesos portion of a written amount. */
export function integerToWords(value: number): string {
  if (value === 0) return 'Zero';
  const groups: number[] = [];
  let remaining = Math.trunc(Math.abs(value));
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const words = groups
    .map((group, index) => (group > 0 ? `${threeDigitsToWords(group)}${SCALES[index] ? ` ${SCALES[index]}` : ''}` : ''))
    .filter(Boolean)
    .reverse();
  return words.join(' ');
}

/**
 * ADR-051 §8 (`{LoanAmountWords}`): Philippine legal documents (Promissory Note, Deed of
 * Assignment) spell out the peso amount in words — matches the legacy Mambu-era
 * `IN_WORDS_INTEGER`/`IN_WORDS_FRACTIONAL` template functions observed in the legacy Mongo
 * `document_templates` collection (ADR-051 §6), reimplemented here rather than migrated wholesale
 * since that data source was not reused.
 */
export function moneyToWords(amount: Decimal): string {
  const rounded = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const pesos = rounded.trunc().toNumber();
  const centavos = rounded.minus(rounded.trunc()).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

  const pesosWords = `${integerToWords(pesos)} Peso${pesos === 1 ? '' : 's'}`;
  if (centavos === 0) return pesosWords;
  return `${pesosWords} and ${integerToWords(centavos)} Centavo${centavos === 1 ? '' : 's'}`;
}
