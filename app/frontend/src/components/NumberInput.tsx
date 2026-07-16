import * as React from 'react';
import { Input } from '@/components/ui/input';

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Minimum decimal places to show (default: 0) */
  minDecimals?: number;
  /** Maximum decimal places to show (default: 2) */
  maxDecimals?: number;
}

/**
 * Number input with thousand separators (commas) for readability, applied LIVE while typing (not
 * just on blur) - staff need to see at a glance whether they're keying in hundreds, thousands, or
 * millions as they go, not only after they tab away.
 *
 * Two things make live comma-formatting on every keystroke safe, where a naive version breaks:
 *
 *  1. Cursor position: reformatting the display string changes its length (commas get inserted/
 *     removed as digit groups shift), so the browser's own cursor-follows-the-edit behavior lands
 *     in the wrong place unless corrected. `handleChange` counts digits before the cursor in the
 *     pre-edit string, reformats, then walks the post-edit string to the position with the same
 *     digit count and explicitly restores the selection there via `requestAnimationFrame` (must
 *     happen after React commits the new value to the DOM, not before).
 *
 *  2. Decimal entry: `liveFormatWithCommas` only ever inserts commas into the integer part and
 *     copies the decimal part through untouched - including a bare trailing "." or a partial
 *     "1234.5" - so it's safe to call on every keystroke. This is deliberately NOT the same as
 *     `formatNumberWithCommas` below (which rounds/pads via `toFixed` and is only ever applied
 *     once, on blur, when a lone "." or "1234.5" needs to become a clean "1,234.50" - doing that
 *     mid-type would round away a decimal point the user hasn't finished entering yet).
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, onFocus, onBlur, minDecimals = 0, maxDecimals = 2, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const isFocusedRef = React.useRef(false);

    const setRefs = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [forwardedRef],
    );

    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      if (!value) return '';
      const numValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
      return formatNumberWithCommas(numValue, minDecimals, maxDecimals);
    });

    React.useEffect(() => {
      // Only sync from an externally-changed `value` (initial mount, product-default prefill,
      // form reset, etc.) when the field isn't focused - while typing, handleChange already keeps
      // displayValue in sync with live comma formatting, and this effect running mid-type would
      // instead apply the stricter toFixed-based formatting and corrupt an in-progress decimal.
      if (isFocusedRef.current) return;

      if (value === undefined || value === '') {
        setDisplayValue('');
        return;
      }
      const numValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
      if (!Number.isNaN(numValue)) {
        setDisplayValue(formatNumberWithCommas(numValue, minDecimals, maxDecimals));
      }
    }, [value, minDecimals, maxDecimals]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const cursorPos = e.target.selectionStart ?? input.length;
      const rawDigits = stripCommas(input);

      if (rawDigits !== '' && !/^-?\d*\.?\d*$/.test(rawDigits)) {
        return; // reject anything that isn't a valid in-progress number
      }

      // How many non-comma characters precede the cursor - this count is what we need to land on
      // after reformatting, since comma positions shift but digit order never does.
      const digitsBeforeCursor = stripCommas(input.slice(0, cursorPos)).length;
      const formatted = liveFormatWithCommas(rawDigits);
      setDisplayValue(formatted);

      if (onChange) {
        const evt = { ...e, target: { ...e.target, value: rawDigits } };
        onChange(evt as React.ChangeEvent<HTMLInputElement>);
      }

      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        let pos = 0;
        let count = 0;
        while (pos < formatted.length && count < digitsBeforeCursor) {
          if (formatted[pos] !== ',') count++;
          pos++;
        }
        el.setSelectionRange(pos, pos);
      });
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      const input = stripCommas(e.target.value);
      if (input && input !== '' && input !== '-') {
        const num = parseFloat(input);
        if (!Number.isNaN(num)) {
          setDisplayValue(formatNumberWithCommas(num, minDecimals, maxDecimals));
        }
      }
      onBlur?.(e);
    };

    return (
      <Input
        ref={setRefs}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';

function stripCommas(value: string): string {
  return value.replace(/,/g, '');
}

/**
 * Adds commas to the integer part only, copying the decimal part (including a bare trailing "."
 * or partial digits like "1234.5") through untouched. Safe to call on every keystroke - unlike
 * `formatNumberWithCommas`, it never rounds or pads, so it can't corrupt a decimal the user is
 * still in the middle of typing.
 */
function liveFormatWithCommas(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const dotIndex = unsigned.indexOf('.');
  const integerPart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const decimalPart = dotIndex === -1 ? '' : unsigned.slice(dotIndex); // includes the "."
  const commaInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + commaInteger + decimalPart;
}

/**
 * Format a number with thousand separators (commas), rounded/padded to a fixed decimal length -
 * only used for the initial mount value, an externally-changed value while unfocused, and on
 * blur. Example: 1234567.89 -> "1,234,567.89"
 */
function formatNumberWithCommas(num: number, minDecimals: number, maxDecimals: number): string {
  if (Number.isNaN(num)) return '';

  const parts = num.toFixed(maxDecimals).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';

  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Handle decimal part (trim trailing zeros if below minDecimals not required)
  let formattedDecimal = decimalPart;
  if (minDecimals > 0 && formattedDecimal.length < minDecimals) {
    formattedDecimal = formattedDecimal.padEnd(minDecimals, '0');
  }

  if (formattedDecimal) {
    return `${formattedInteger}.${formattedDecimal}`;
  }
  return formattedInteger;
}
