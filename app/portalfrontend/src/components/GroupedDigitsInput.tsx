import * as React from 'react';
import { Input } from '@/components/ui/Input';

interface GroupedDigitsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Digits per group, e.g. 4 -> "XXXX XXXX XXXX". Default 4. */
  groupSize?: number;
  /** Total digit cap across all groups, e.g. 12 for a 4-4-4 SSS/TIN number. Default 12. */
  maxDigits?: number;
}

/**
 * Live-formats a digits-only ID number (SSS, TIN) into space-separated groups - e.g. groupSize 4
 * -> "XXXX XXXX XXXX" - while typing, not just on blur. Stores/forwards the raw digits-only value
 * to the parent; only the on-screen display carries the spaces. Ported from the internal LMS
 * frontend's own GroupedDigitsInput (2026-07-30 user request, LMS parity).
 *
 * Shares NumberInput's cursor-position-preserving approach: counts digits before the cursor
 * pre-edit, reformats, then restores the selection at the matching digit count post-edit via
 * `requestAnimationFrame` (a naive reformat-on-every-keystroke resets the cursor to the end after
 * each character).
 */
export const GroupedDigitsInput = React.forwardRef<HTMLInputElement, GroupedDigitsInputProps>(
  ({ value, onChange, groupSize = 4, maxDigits = 12, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [forwardedRef],
    );

    const format = React.useCallback((digits: string) => groupDigits(digits, groupSize), [groupSize]);

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      format(typeof value === 'string' ? stripNonDigits(value) : ''),
    );
    const isFocusedRef = React.useRef(false);

    React.useEffect(() => {
      if (isFocusedRef.current) return;
      setDisplayValue(format(typeof value === 'string' ? stripNonDigits(value) : ''));
    }, [value, format]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const cursorPos = e.target.selectionStart ?? input.length;
      const rawDigits = stripNonDigits(input).slice(0, maxDigits);

      const digitsBeforeCursor = stripNonDigits(input.slice(0, cursorPos)).length;
      const formatted = format(rawDigits);
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
          if (formatted[pos] !== ' ') count++;
          pos++;
        }
        el.setSelectionRange(pos, pos);
      });
    };

    return (
      <Input
        ref={setRefs}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);

GroupedDigitsInput.displayName = 'GroupedDigitsInput';

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** "123456789012" with groupSize 4 -> "1234 5678 9012"; a shorter in-progress value formats as far as it goes. */
function groupDigits(digits: string, groupSize: number): string {
  const clean = stripNonDigits(digits);
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += groupSize) {
    groups.push(clean.slice(i, i + groupSize));
  }
  return groups.join(' ');
}
