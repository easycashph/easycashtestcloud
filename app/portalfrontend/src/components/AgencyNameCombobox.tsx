import * as React from 'react';
import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import type { LicensedRecruitmentAgency } from '@/lib/portalApiTypes';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * 2026-09-15 (user request): searchable combobox backed by DMW's own licensed recruitment
 * agencies directory, for the Seafarer Loan application's "Agency" field (fills the same
 * `employer` value every other loan category's "Name of employer" field uses - a seafarer's
 * manning agency IS their employer, so this is a smarter widget over the existing field, not a
 * new one). Mirrors app/lmsfrontend's own AgencyNameCombobox, adapted to the portal's plain
 * fetch-based apiClient (no react-query here) and its own UI primitives.
 *
 * Deliberately NOT a picker that only accepts a listed agency - free text always works, since an
 * agency newly licensed after this snapshot, or missing from it for any other reason, must never
 * block an applicant from recording what's actually on their contract. Selecting a suggestion is
 * a shortcut that fills in the exact DMW-recorded name, nothing more.
 */
export function AgencyNameCombobox({
  id,
  value,
  onChange,
  onSelectAgency,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired (in addition to onChange) when a suggestion is picked, with the full matched record -
   * lets a caller auto-fill related fields (e.g. office address) from the same selection. */
  onSelectAgency?: (agency: LicensedRecruitmentAgency) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  const [results, setResults] = React.useState<LicensedRecruitmentAgency[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const trimmed = debouncedValue.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const showPanel = open && canSearch;

  React.useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<{ items: LicensedRecruitmentAgency[] }>(`/portal/licensed-recruitment-agencies?q=${encodeURIComponent(trimmed)}`)
      .then((data) => {
        if (!cancelled) setResults(data.items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, canSearch]);

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
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search DMW-licensed agencies…"
        autoComplete="off"
      />
      {showPanel && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-72 overflow-y-auto rounded-lg border border-border bg-card text-foreground shadow-md">
          {isLoading ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No DMW-licensed agency matches &ldquo;{trimmed}&rdquo; - your typed text is kept as-is.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {results.map((agency) => (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => {
                    onChange(agency.name);
                    onSelectAgency?.(agency);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/60"
                >
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{agency.name}</span>
                    {agency.address && <span className="block truncate text-muted-foreground">{agency.address}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
