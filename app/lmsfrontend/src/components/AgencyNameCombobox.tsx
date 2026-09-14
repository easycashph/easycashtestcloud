import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/apiClient';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { LicensedRecruitmentAgency } from '@/lib/licensedRecruitmentAgencyApiTypes';

const MIN_QUERY_LENGTH = 2;

/** Statuses that read as "currently allowed to recruit" - everything else (Expired, Cancelled,
 * Delisted, Forever Banned, Suspended, etc.) gets the muted/destructive treatment instead, per
 * DMW's own status vocabulary (see LicensedRecruitmentAgency Prisma model's doc comment - 18
 * distinct values seen in one capture, not a fixed enum). */
const VALID_STATUSES = new Set(['Valid License', 'Valid License - Full', 'Valid License - Provisional', 'VALID LICENSE (EXTENDED)']);

function statusBadgeVariant(status: string): 'success' | 'destructive' {
  return VALID_STATUSES.has(status) ? 'success' : 'destructive';
}

/**
 * 2026-09-14 (Agency name dropdown, user request): searchable combobox backed by DMW's own
 * licensed recruitment agencies directory (LicensedRecruitmentAgency, ~3,800 rows - see that
 * Prisma model's doc comment for the source/capture details), for the Seafarer Loan "Agency /
 * contract / allotment verification" section's Agency name field.
 *
 * Deliberately NOT a picker that only accepts a listed agency - free text always works (the
 * `value`/`onChange` pair behaves exactly like a plain `<Input>`), since an agency newly licensed
 * after this snapshot, or missing from it for any other reason, must never block staff from
 * recording what's actually on the applicant's documents. Selecting a suggestion is a shortcut
 * that fills in the exact DMW-recorded name, nothing more.
 *
 * Modeled on GlobalSearch.tsx's own hand-rolled dropdown panel (no Radix Popover in this
 * codebase, small enough widget not to warrant adding one) - same debounced-query, outside-click/
 * Escape-to-close, absolutely-positioned-panel shape.
 */
export function AgencyNameCombobox({
  value,
  onChange,
  onSelectAgency,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired (in addition to onChange) when a suggestion is picked, with the full matched record -
   * lets a caller auto-fill related fields (address, contact number) from the same selection. */
  onSelectAgency?: (agency: LicensedRecruitmentAgency) => void;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const debouncedValue = useDebouncedValue(value, 300);
  const trimmed = debouncedValue.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const showPanel = open && canSearch;

  const searchQuery = useQuery({
    queryKey: ['licensed-recruitment-agencies', trimmed],
    queryFn: () => apiClient.get<{ items: LicensedRecruitmentAgency[] }>(`/licensed-recruitment-agencies?q=${encodeURIComponent(trimmed)}`),
    enabled: canSearch,
  });

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

  const results = searchQuery.data?.items ?? [];

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search DMW-licensed agencies…"
        className={className}
        autoComplete="off"
      />
      {showPanel && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {searchQuery.isLoading ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No DMW-licensed agency matches &ldquo;{trimmed}&rdquo; - your typed text is kept as-is.
            </p>
          ) : (
            <div className="divide-y">
              {results.map((agency) => (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => {
                    onChange(agency.name);
                    onSelectAgency?.(agency);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60"
                >
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{agency.name}</span>
                    {agency.address && <span className="block truncate text-muted-foreground">{agency.address}</span>}
                  </span>
                  <Badge variant={statusBadgeVariant(agency.status)} className={cn('shrink-0 text-[10px]')}>
                    {agency.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
