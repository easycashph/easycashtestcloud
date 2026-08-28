import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Phone number input that shows a fixed "+63" country-code prefix and live-formats the local
 * 10-digit number as "917 123 4567" while typing - matches `formatMobileNumber()` in
 * `lib/utils.ts`, the same "+63 917 123 4567" grouping used for read-only display everywhere else
 * in the app. Stores/forwards the raw digits to the parent as the canonical 11-digit
 * leading-zero shape ("09171234567") regardless of how the incoming `value` was shaped - see
 * `toLocal10()` below for why that's needed (legacy SDevTech data arrives in several shapes).
 *
 * Shares the same cursor-position-preserving approach as `NumberInput` (see that component's own
 * doc comment for why a naive "reformat on every keystroke" breaks typing): counts digits before
 * the cursor pre-edit, reformats, then walks the post-edit string to the matching digit count and
 * restores the selection there via `requestAnimationFrame`.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ value, onChange, className, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [forwardedRef],
    );

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      formatLocal(toLocal10(typeof value === 'string' ? value : '')),
    );
    const isFocusedRef = React.useRef(false);

    React.useEffect(() => {
      if (isFocusedRef.current) return; // don't stomp an in-progress edit
      setDisplayValue(formatLocal(toLocal10(typeof value === 'string' ? value : '')));
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
      const local = stripNonDigits(input).slice(0, 10); // editable part is the 10-digit local number

      const digitsBeforeCursor = stripNonDigits(input.slice(0, cursorPos)).length;
      const formatted = formatLocal(local);
      setDisplayValue(formatted);

      if (onChange) {
        const raw = local ? `0${local}` : '';
        const evt = { ...e, target: { ...e.target, value: raw } };
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
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-sm text-muted-foreground">+63</span>
        <Input
          ref={setRefs}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          className={className}
          {...props}
        />
      </div>
    );
  },
);

PhoneInput.displayName = 'PhoneInput';

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normalizes any of the shapes legacy PH mobile numbers show up in - 11-digit "0917...", 12-digit
 * "63917..." with no "+", or a bare 10-digit local number - down to the 10-digit local number
 * (mirrors `formatMobileNumber()` in `lib/utils.ts`). A partial/in-progress value that doesn't
 * match any of those shapes is passed through digit-stripped and truncated, so typing still works.
 */
function toLocal10(value: string): string {
  const digits = stripNonDigits(value);
  if (digits.length === 12 && digits.startsWith('63')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

/** "9171234567" -> "917 123 4567"; a shorter in-progress value formats as far as it goes. */
function formatLocal(local: string): string {
  const part1 = local.slice(0, 3);
  const part2 = local.slice(3, 6);
  const part3 = local.slice(6, 10);
  return [part1, part2, part3].filter(Boolean).join(' ');
}
