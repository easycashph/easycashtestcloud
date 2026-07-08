import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { fetchAllPages } from '@/lib/apiClient';
import type { Borrower, LoanAccount, LoanAccountStatus } from '@/lib/loanApiTypes';

/** Matches LoanListPage's real status set — the mock data's extra 'MATURED' status doesn't exist in the real API. */
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
 */
export function ClientListPage() {
  const navigate = useNavigate();
  useLogPageView('Client Data');
  const [search, setSearch] = React.useState('');
  const [loanPresence, setLoanPresence] = React.useState<LoanPresenceFilter>('ALL');

  const borrowersQuery = useQuery({
    queryKey: ['borrowers', 'all'],
    queryFn: () => fetchAllPages<Borrower>('/borrowers'),
  });
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
      (borrowersQuery.data ?? []).map((b) => {
        const loans = loansByBorrowerId.get(b.id) ?? [];
        return {
          id: b.id,
          name: b.fullName,
          contactNumber: b.mobilePhone1 ?? '—',
          email: b.email ?? '—',
          employer: b.incomeDetail?.employerName ?? '—',
          position: b.incomeDetail?.position ?? '—',
          loanCount: loans.length,
          hasActiveLoan: loans.some((l) => REAL_ACTIVE_LOAN_STATUSES.includes(l.status)),
        };
      }),
    [borrowersQuery.data, loansByBorrowerId],
  );

  const filtered = rows.filter((c) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      c.name.toLowerCase().includes(query) ||
      c.employer.toLowerCase().includes(query) ||
      c.contactNumber.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.position.toLowerCase().includes(query);
    const matchesLoanPresence =
      loanPresence === 'ALL' ||
      (loanPresence === 'WITH_ACTIVE' && c.hasActiveLoan) ||
      (loanPresence === 'WITH_HISTORY' && c.loanCount > 0) ||
      (loanPresence === 'NONE' && c.loanCount === 0);
    return matchesSearch && matchesLoanPresence;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Client Data</h2>
        <p className="text-sm text-muted-foreground">{isLoading ? 'Loading…' : `${rows.length} borrower profiles.`}</p>
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
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length} clients shown.
          </p>
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
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <p className="font-medium">{c.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{c.contactNumber}</p>
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
              {!isLoading && filtered.length === 0 && (
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
        </CardContent>
      </Card>

      {/* 2026-07-08 (F-5 fix): real client actions (Create Client, Edit) log entityType 'Client'
          (singular) — the page-view-only 'Client Data' filter never matched them. */}
      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Client' || l.entityType === 'Client Data')}
        title="Recent Activity — Client Data"
      />
    </div>
  );
}
