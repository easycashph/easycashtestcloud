import * as React from 'react';
import { Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SEAFARER_POSITIONS } from '@/lib/seafarerPositions';

/**
 * 2026-09-14 (seafarer position suggestions, user request): searchable combobox over a static
 * reference list of common seafarer ranks/positions (see seafarerPositions.ts - general maritime
 * terminology, not an official registry like DMW's agency directory), for the Seafarer Loan
 * "Agency / contract / allotment verification" section's Position field.
 *
 * Deliberately free text, same as AgencyNameCombobox - picking a suggestion is a shortcut, never a
 * restriction, since an applicant's actual position may not appear on this reference list.
 */
export function SeafarerPositionCombobox({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const trimmed = value.trim().toLowerCase();
  const results = trimmed
    ? SEAFARER_POSITIONS.filter((p) => p.toLowerCase().includes(trimmed)).slice(0, 10)
    : SEAFARER_POSITIONS.slice(0, 10);
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
        placeholder="Type or pick a position…"
        className={className}
        autoComplete="off"
      />
      {showPanel && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="divide-y">
            {results.map((position) => (
              <button
                key={position}
                type="button"
                onClick={() => {
                  onChange(position);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60"
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{position}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
