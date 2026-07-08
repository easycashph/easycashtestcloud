import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { ACTIVE_LOAN_STATUSES, MOCK_ACTIVITY_LOGS, MOCK_BORROWERS, MOCK_LOANS, type MockBorrowerProfile } from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

const BRANCH_OPTIONS = ['ALL', ...[...new Set(MOCK_BORROWERS.map((b) => b.homeBranchName))].sort()];

type LoanPresenceFilter = 'ALL' | 'WITH_ACTIVE' | 'WITH_HISTORY' | 'NONE';

const LOAN_PRESENCE_OPTIONS: { value: LoanPresenceFilter; label: string }[] = [
  { value: 'ALL', label: 'All clients' },
  { value: 'WITH_ACTIVE', label: 'With active loan' },
  { value: 'WITH_HISTORY', label: 'With loan history' },
  { value: 'NONE', label: 'No loans yet' },
];

// 2026-07-08 (F-3 fix): was a hand-rolled copy of the "active loan" statuses that had drifted from
// `clientHasActiveLoan()` in mockData.ts (the function that actually gates "Create Loan Account").
// Now shares that one definition via `ACTIVE_LOAN_STATUSES`.
function hasActiveLoan(b: MockBorrowerProfile): boolean {
  return MOCK_LOANS.some((l) => b.loanIds.includes(l.id) && ACTIVE_LOAN_STATUSES.includes(l.status));
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function getSortValue(b: MockBorrowerProfile, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'name':
      return b.name;
    case 'contactNumber':
      return b.contactNumber;
    case 'employer':
      return b.employer;
    case 'homeBranchName':
      return b.homeBranchName;
    case 'loans':
      return b.loanIds.length;
    default:
      return undefined;
  }
}

export function ClientListPage() {
  const navigate = useNavigate();
  useLogPageView('Client Data');
  const [search, setSearch] = React.useState('');
  const [branch, setBranch] = React.useState('ALL');
  const [loanPresence, setLoanPresence] = React.useState<LoanPresenceFilter>('ALL');

  const filtered = MOCK_BORROWERS.filter((b) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      b.name.toLowerCase().includes(query) ||
      b.employer.toLowerCase().includes(query) ||
      b.homeBranchName.toLowerCase().includes(query) ||
      b.contactNumber.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query) ||
      b.position.toLowerCase().includes(query);
    const matchesBranch = branch === 'ALL' || b.homeBranchName === branch;
    const matchesLoanPresence =
      loanPresence === 'ALL' ||
      (loanPresence === 'WITH_ACTIVE' && hasActiveLoan(b)) ||
      (loanPresence === 'WITH_HISTORY' && b.loanIds.length > 0) ||
      (loanPresence === 'NONE' && b.loanIds.length === 0);
    return matchesSearch && matchesBranch && matchesLoanPresence;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Client Data</h2>
        <p className="text-sm text-muted-foreground">{MOCK_BORROWERS.length} sample borrower profiles.</p>
      </div>

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
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by home branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANCH_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b === 'ALL' ? 'All branches' : b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {filtered.length} of {MOCK_BORROWERS.length} clients shown.
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
                <SortableTableHead sortKey="homeBranchName" currentSort={sort} onSort={toggleSort}>
                  Home Branch
                </SortableTableHead>
                <SortableTableHead sortKey="loans" currentSort={sort} onSort={toggleSort} className="text-right">
                  Loans
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/clients/${b.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={b.profilePictureUrl} alt={b.name} />
                        <AvatarFallback>{initials(b.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPeso(b.monthlyIncome)}/mo income</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{b.contactNumber}</p>
                    <p className="text-xs text-muted-foreground">{b.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{b.employer}</p>
                    <p className="text-xs text-muted-foreground">{b.position}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.homeBranchName}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{b.loanIds.length}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No sample clients match your search.
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
