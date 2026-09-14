import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * 2026-09-14: shared free-text-plus-suggestions combobox over a small, fixed, client-side list
 * (seafarer positions, Philippine banks, etc.) - no backend search needed since these lists are
 * short and stable, unlike the DMW agency directory (AgencyNameCombobox, ~3,800 rows, searched via
 * API). Picking a suggestion is always a shortcut, never a restriction: the field stays free text
 * so a value missing from the list is never blocked.
 */
export function StaticSuggestionsCombobox({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  icon: LucideIcon;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const trimmed = value.trim().toLowerCase();
  const results = trimmed ? options.filter((o) => o.toLowerCase().includes(trimmed)).slice(0, 10) : options.slice(0, 10);
  const showPanel = open && results.length > 0;

  React.useEffect(() => {
    if (!showPanel) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPanel]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showPanel && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="divide-y">
            {results.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
