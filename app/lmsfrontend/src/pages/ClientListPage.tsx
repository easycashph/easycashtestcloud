import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { fetchAllPages } from '@/lib/apiClient';
import type { Borrower, LoanAccount, LoanAccountStatus } from '@/lib/loanApiTypes';
import { formatMobileNumber } from '@/lib/utils';

const PAGE_SIZE = 25;

/** Matches LoanListPage's real status set - the mock data's extra 'MATURED' status doesn't exist in the real API. */
const REAL_ACTIVE_LOAN_STATUSES: LoanAccountStatus[] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

type LoanPresenceFilter = 'ALL' | 'WITH_ACTIVE' | 'WITH_HISTORY' | 'NONE';

const LOAN_PRESENCE_OPTIONS: { value: LoanPresenceFilter; label: string }[] = [
  { value: 'ALL', label: 'All clients' },
  { value: 'WITH_ACTIVE', label: 'With active loan' },
  { value: 'WITH_HISTORY', label: 'With loan history' },
  { value: 'NONE', label: 'No loans yet' },
];

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

interface ClientRow {
  id: string;
  name: string;
  contactNumber: string;
  email: string;
  employer: string;
  position: string;
  loanCount: number;
  hasActiveLoan: boolean;
}

function getSortValue(c: ClientRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'name':
      return c.name;
    case 'contactNumber':
      return c.contactNumber;
    case 'employer':
      return c.employer;
    case 'loans':
      return c.loanCount;
    default:
      return undefined;
  }
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. Real `GET /borrowers` +
 * `/loan-accounts` replace `MOCK_BORROWERS`/`MOCK_LOANS`. No branch filter/column, same reasoning
 * as `LoanListPage.tsx`: no `GET /branches` endpoint yet, and every migrated record currently
 * belongs to the single seeded "HQ" branch anyway.
 *
 * Real, server-side pagination (25 rows/page, Next/Previous - see `useCursorPagination`) replaced
 * the earlier "load every borrower up front" approach, which was the direct cause of frontend lag.
 * Search and "Loan presence" (2026-07-16) both go to backend query params, so a full page of up to
 * 25 matching rows is always shown even with a filter applied - Loan presence is a Prisma relation
 * filter (`loanAccounts: { some/none: {...} }`) on the borrower repository. The per-row Loans
 * count/badge still needs every loan account regardless of the filter, so `loansQuery` below stays
 * a full `fetchAllPages` load.
 */
export function ClientListPage() {
  const navigate = useNavigate();
  const { canManageClients } = useRole();
  useLogPageView('List of Clients');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [loanPresence, setLoanPresence] = React.useState<LoanPresenceFilter>('ALL');

  const {
    items: borrowers,
    query: borrowersQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<Borrower>(
    ['borrowers'],
    '/borrowers',
    { search: debouncedSearch, loanPresence: loanPresence === 'ALL' ? undefined : loanPresence },
    PAGE_SIZE,
  );

  // Still loaded in full - needed to compute the "Loans" column/filter for whichever borrowers are
  // on the current page. Loan accounts aren't yet searchable/filterable by borrowerId server-side,
  // so this stays a `fetchAllPages` call rather than being paginated itself.
  const loansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<LoanAccount>('/loan-accounts'),
  });
  const isLoading = borrowersQuery.isLoading || loansQuery.isLoading;

  const loansByBorrowerId = React.useMemo(() => {
    const map = new Map<string, LoanAccount[]>();
    for (const l of loansQuery.data ?? []) {
      const list = map.get(l.borrowerId) ?? [];
      list.push(l);
      map.set(l.borrowerId, list);
    }
    return map;
  }, [loansQuery.data]);

  const rows: ClientRow[] = React.useMemo(
    () =>
      borrowers.map((b) => {
        const loans = loansByBorrowerId.get(b.id) ?? [];
        return {
          id: b.id,
          name: b.fullName,
          contactNumber: b.mobilePhone1 ?? '-',
          email: b.email ?? '-',
          employer: b.incomeDetail?.employerName ?? '-',
          position: b.incomeDetail?.position ?? '-',
          loanCount: loans.length,
          hasActiveLoan: loans.some((l) => REAL_ACTIVE_LOAN_STATUSES.includes(l.status)),
        };
      }),
    [borrowers, loansByBorrowerId],
  );

  // loanPresence is already server-filtered above (via useCursorPagination's extraParams).
  const { sorted, sort, toggleSort } = useSortableTable(rows, getSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">List of Clients</h2>
          <p className="text-sm text-muted-foreground">{isLoading ? 'Loading…' : `${rows.length} borrower profiles on this page.`}</p>
        </div>
        {canManageClients && <Button onClick={() => navigate('/clients/new')}>Add Client</Button>}
      </div>

      {borrowersQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load clients. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, contact, email, employer..."
                className="w-full pl-8 sm:w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={loanPresence} onValueChange={(v) => setLoanPresence(v as LoanPresenceFilter)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by loan presence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAN_PRESENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{rows.length} clients shown.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSort={sort} onSort={toggleSort}>
                  Client
                </SortableTableHead>
                <SortableTableHead sortKey="contactNumber" currentSort={sort} onSort={toggleSort}>
                  Contact
                </SortableTableHead>
                <SortableTableHead sortKey="employer" currentSort={sort} onSort={toggleSort}>
                  Employer
                </SortableTableHead>
                <SortableTableHead sortKey="loans" currentSort={sort} onSort={toggleSort} className="text-right">
                  Loans
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ApplicantAvatar
                        ownerType="BORROWER"
                        ownerId={c.id}
                        initials={initials(c.name)}
                        className="h-8 w-8"
                        fallbackClassName="text-xs"
                      />
                      <p className="font-medium">{c.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{formatMobileNumber(c.contactNumber)}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{c.employer}</p>
                    <p className="text-xs text-muted-foreground">{c.position}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{c.loanCount}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No clients match your search.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Loading clients…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            pageNumber={pageNumber}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={goNext}
            onPrev={goPrev}
            pageSize={PAGE_SIZE}
            itemCount={borrowers.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel label="List of Clients" />
    </div>
  );
}
