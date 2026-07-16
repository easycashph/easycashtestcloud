import * as React from 'react';
import { Input } from '@/components/ui/input';

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Minimum decimal places to show (default: 0) */
  minDecimals?: number;
  /** Maximum decimal places to show (default: 2) */
  maxDecimals?: number;
}

/**
 * Number input with thousand separators (commas) for readability.
 * Stores raw numeric value internally, displays formatted with commas.
 * Handles currency/financial fields without forcing a specific currency symbol.
 *
 * Formats with commas only while the field is NOT focused (on mount, on blur, and when the
 * parent resets the value externally) - never while the user is actively typing. Reformatting
 * on every keystroke (via a naive value-watching useEffect) breaks typing entirely: the cursor
 * jumps to the end after each character, and a trailing decimal point ("1234.") gets silently
 * dropped mid-type because `parseFloat("1234.")` rounds it back to "1234" before the user can
 * type the fractional digits. Tracking focus and skipping the reformat while typing avoids both.
 *
 * Example: as user types "1000000", displays "1000000" while typing, then "1,000,000" on blur.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, onFocus, onBlur, minDecimals = 0, maxDecimals = 2, ...props }, ref) => {
    const isFocusedRef = React.useRef(false);
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      if (!value) return '';
      const numValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
      return formatNumberWithCommas(numValue, minDecimals, maxDecimals);
    });

    React.useEffect(() => {
      // Never stomp the display value while the user is actively typing - only sync from an
      // externally-changed `value` (initial mount, product-default prefill, form reset, etc.)
      // when the field isn't focused.
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
      // Switch to the raw (comma-free) value so the user edits plain digits, not a formatted
      // string whose comma positions shift under them as they type.
      setDisplayValue(stripCommas(displayValue));
      onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Allow empty, just digits, decimals, minus sign
      if (input === '' || /^-?\d*\.?\d*$/.test(input)) {
        setDisplayValue(input);

        // Pass the raw numeric value to the parent, not the formatted one
        if (onChange) {
          const evt = {
            ...e,
            target: { ...e.target, value: input },
          };
          onChange(evt as React.ChangeEvent<HTMLInputElement>);
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      const input = e.target.value;
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
        ref={ref}
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
 * Format a number with thousand separators (commas).
 * Example: 1234567.89 -> "1,234,567.89"
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
