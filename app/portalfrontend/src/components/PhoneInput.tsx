import * as React from 'react';
import { Input } from '@/components/ui/Input';

/**
 * Phone number input that live-formats as "09XX XXX XXXX" (4-3-4 digit grouping) while typing -
 * ported from the internal LMS frontend's own PhoneInput (2026-07-31 user request, LMS parity).
 * Stores/forwards the raw digits-only value to the parent; only the on-screen display carries the
 * spaces.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ value, onChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [forwardedRef],
    );

    const [displayValue, setDisplayValue] = React.useState<string>(() => formatPhone(typeof value === 'string' ? value : ''));
    const isFocusedRef = React.useRef(false);

    React.useEffect(() => {
      if (isFocusedRef.current) return;
      setDisplayValue(formatPhone(typeof value === 'string' ? value : ''));
    }, [value]);

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
      const rawDigits = stripNonDigits(input).slice(0, 11);

      const digitsBeforeCursor = stripNonDigits(input.slice(0, cursorPos)).length;
      const formatted = formatPhone(rawDigits);
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

PhoneInput.displayName = 'PhoneInput';

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** "09171234567" -> "0917 123 4567"; a shorter in-progress value formats as far as it goes. */
function formatPhone(digits: string): string {
  const clean = stripNonDigits(digits);
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 7);
  const part3 = clean.slice(7, 11);
  return [part1, part2, part3].filter(Boolean).join(' ');
}
