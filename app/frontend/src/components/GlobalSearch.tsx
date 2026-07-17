import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileCheck2, Landmark, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { apiClient } from '@/lib/apiClient';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { STATUS_DISPLAY_LABEL } from '@/lib/loanApplicationStatusLabels';
import type { Borrower, LoanAccount } from '@/lib/loanApiTypes';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import { formatPeso } from '@/lib/utils';

interface CursorPage<T> {
  items: T[];
}

interface GlobalSearchResults {
  clients: Borrower[];
  loans: LoanAccount[];
  applications: LoanApplication[];
}

const MIN_QUERY_LENGTH = 2;
const RESULTS_PER_GROUP = 5;

/**
 * Global Search (2026-07-17 user request) - fans out to the three existing entity list endpoints'
 * own `?search=` param (Borrowers: firstName/middleName/lastName/email/mobilePhone; LoanAccounts:
 * loanCode/borrower name; LoanApplications: applicantName - see each repository's own `findMany`),
 * `limit=5` each, no new backend endpoint needed.
 *
 * 2026-07-17 fix: the first version wrapped the results in Radix `DropdownMenu` with the `Input`
 * as its trigger. `DropdownMenu` is a menu widget - it captures keydown on its trigger for roving
 * focus / type-to-select-an-item, which fought with normal text typing (couldn't type, dropdown
 * closed mid-keystroke). Rebuilt as a plain controlled dropdown (absolutely-positioned panel +
 * manual outside-click/Escape handling) - no Radix menu semantics, so the `Input` behaves like any
 * other text input. No `@radix-ui/react-popover` dependency in this codebase to reach for instead;
 * this is a small enough widget that a hand-rolled panel is simpler than adding one.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const trimmed = debouncedQuery.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  const showPanel = open && canSearch;

  const searchQuery = useQuery({
    queryKey: ['global-search', trimmed],
    queryFn: async (): Promise<GlobalSearchResults> => {
      const q = encodeURIComponent(trimmed);
      const [clientsPage, loansPage, applicationsPage] = await Promise.all([
        apiClient.get<CursorPage<Borrower>>(`/borrowers?search=${q}&limit=${RESULTS_PER_GROUP}`),
        apiClient.get<CursorPage<LoanAccount>>(`/loan-accounts?search=${q}&limit=${RESULTS_PER_GROUP}`),
        apiClient.get<CursorPage<LoanApplication>>(`/loan-applications?search=${q}&limit=${RESULTS_PER_GROUP}`),
      ]);
      return { clients: clientsPage.items, loans: loansPage.items, applications: applicationsPage.items };
    },
    enabled: canSearch,
  });

  // Close on outside click/tap and on Escape - the manual equivalent of what Radix's
  // DismissableLayer used to give us for free.
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

  const results = searchQuery.data;
  const totalResults = results ? results.clients.length + results.loans.length + results.applications.length : 0;

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients, loans, applications…"
        className="w-56 pl-8 lg:w-72"
      />
      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-[28rem] w-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {searchQuery.isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
          ) : totalResults === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No matches for &ldquo;{trimmed}&rdquo;.</p>
          ) : (
            <div className="divide-y">
              {results!.clients.length > 0 && (
                <div>
                  <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clients</p>
                  {results!.clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(`/clients/${c.id}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{c.fullName}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {c.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {results!.loans.length > 0 && (
                <div>
                  <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Loan Accounts</p>
                  {results!.loans.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => go(`/loans/${l.id}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{l.loanCode}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatPeso(Number(l.principalAmount))}</span>
                      <LoanStatusBadge status={l.status} />
                    </button>
                  ))}
                </div>
              )}
              {results!.applications.length > 0 && (
                <div>
                  <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Loan Applications</p>
                  {results!.applications.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => go(`/applications/${a.id}`)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      <FileCheck2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{a.applicantName}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {STATUS_DISPLAY_LABEL[a.status]}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
