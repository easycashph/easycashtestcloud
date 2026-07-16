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
 * Example: as user types "1000000", displays "1,000,000"
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, minDecimals = 0, maxDecimals = 2, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      if (!value) return '';
      const numValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
      return formatNumberWithCommas(numValue, minDecimals, maxDecimals);
    });

    React.useEffect(() => {
      if (value === undefined || value === '') {
        setDisplayValue('');
        return;
      }
      const numValue = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : 0;
      if (!Number.isNaN(numValue)) {
        setDisplayValue(formatNumberWithCommas(numValue, minDecimals, maxDecimals));
      }
    }, [value, minDecimals, maxDecimals]);

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
      const input = e.target.value;
      if (input && input !== '' && input !== '-') {
        const num = parseFloat(input);
        if (!Number.isNaN(num)) {
          setDisplayValue(formatNumberWithCommas(num, minDecimals, maxDecimals));
        }
      }
      props.onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';

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
