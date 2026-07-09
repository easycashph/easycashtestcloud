import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FilePlus2, Lock, MailOpen, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { apiClient } from '@/lib/apiClient';
import type { LoanApplication, LoanApplicationStatus } from '@/lib/loanApplicationApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

const PAGE_SIZE = 100;

function applicantInitials(name: string) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function getSortValue(app: LoanApplication, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'applicantName':
      return app.applicantName;
    case 'requestedCategory':
      return app.requestedCategory;
    case 'requestedAmount':
      return app.requestedAmount;
    case 'status':
      return app.status;
    case 'reviewState':
      return app.reviewState;
    case 'createdAt':
      return new Date(app.createdAt);
    default:
      return undefined;
  }
}

const STATUS_OPTIONS: { value: LoanApplicationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DECLINED', label: 'Declined' },
];

const STATUS_BADGE_VARIANT: Record<LoanApplicationStatus, 'warning' | 'success' | 'destructive'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

/**
 * Wired to the real backend Loan Applications module (`GET /loan-applications`,
 * `POST /loan-applications/:id/mark-reviewed`). `reviewState` (Reviewed/Unreviewed) is a separate
 * email-inbox-style "seen" flag, independent of the approve/decline decision — the backend only
 * exposes a one-way mark-reviewed transition (no "mark unreviewed"), so the bulk action below is
 * one-directional to match.
 *
 * Real, server-side pagination (100 rows/page — see `useCursorPagination`) replaced loading every
 * application up front. Applicant-name search goes to the backend's `?search=` param (debounced);
 * status and category have no backend filter param yet, so those two narrow within the current page
 * only, not across every application.
 */
export function LoanApplicationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, currentAccount } = useRole();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = React.useState<LoanApplicationStatus | 'ALL'>('ALL');
  const [category, setCategory] = React.useState('ALL');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  useLogPageView('Loan Applications');

  const {
    items: applications,
    query: applicationsQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<LoanApplication>(
    ['loan-applications'],
    '/loan-applications',
    { search: debouncedSearch },
    PAGE_SIZE,
    canAccessLoanApplications,
  );

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<LoanApplication>(`/loan-applications/${id}/mark-reviewed`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] });
    },
  });

  const categoryOptions = React.useMemo(
    () => ['ALL', ...[...new Set(applications.map((a) => a.requestedCategory))].sort()],
    [applications],
  );

  // Computed unconditionally, before the early return below, so
  // useSortableTable's hook call is never skipped on some renders.
  const filtered = applications.filter((app) => {
    const matchesStatus = status === 'ALL' || app.status === status;
    const matchesCategory = category === 'ALL' || app.requestedCategory === category;
    return matchesStatus && matchesCategory;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'createdAt', direction: 'desc' });

  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Loan Applications</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS, Loan Operation Manager, and CRM accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}) — this
              role does not have access to Loan Applications.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === 'PENDING_REVIEW').length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  const toggleSelectAll = () => {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((a) => a.id)));
  };

  const toggleSelectRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markSelectedReviewed = async () => {
    const targets = applications.filter((app) => selected.has(app.id) && app.reviewState === 'UNREVIEWED');
    await Promise.all(targets.map((app) => markReviewedMutation.mutateAsync(app.id)));
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Loan Applications</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length} application{applications.length === 1 ? '' : 's'} on this page ({pendingCount} pending decision) —
            intake, review, and decision workflow, wired to the live backend.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => navigate('/applications/new')} title="Encode a walk-in applicant's paper application (Form ECLC-LOFN01)">
          <FilePlus2 className="mr-2 h-4 w-4" /> Create Application
        </Button>
      </div>

      {applicationsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan applications. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applicant name..."
                className="w-full pl-8 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as LoanApplicationStatus | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'ALL' ? 'All categories' : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0 || markReviewedMutation.isPending}
              onClick={() => void markSelectedReviewed()}
            >
              <MailOpen className="mr-1.5 h-3.5 w-3.5" /> Mark as Reviewed
            </Button>
            {selected.size > 0 && <span className="text-xs text-muted-foreground">{selected.size} selected</span>}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <SortableTableHead sortKey="applicantName" currentSort={sort} onSort={toggleSort}>
                  Applicant
                </SortableTableHead>
                <SortableTableHead sortKey="requestedCategory" currentSort={sort} onSort={toggleSort}>
                  Requested Category
                </SortableTableHead>
                <SortableTableHead sortKey="requestedAmount" currentSort={sort} onSort={toggleSort} className="text-right">
                  Amount
                </SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Decision Status
                </SortableTableHead>
                <SortableTableHead sortKey="reviewState" currentSort={sort} onSort={toggleSort}>
                  Review
                </SortableTableHead>
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Submitted
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((app) => (
                <TableRow key={app.id} className={app.reviewState === 'UNREVIEWED' ? 'font-medium' : undefined}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selected.has(app.id)}
                      onChange={() => toggleSelectRow(app.id)}
                      aria-label={`Select ${app.applicantName}`}
                    />
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{applicantInitials(app.applicantName)}</AvatarFallback>
                      </Avatar>
                      <span>{app.applicantName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    {app.requestedCategory}
                  </TableCell>
                  <TableCell className="cursor-pointer text-right" onClick={() => navigate(`/applications/${app.id}`)}>
                    {formatPeso(app.requestedAmount)}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <Badge variant={STATUS_BADGE_VARIANT[app.status]}>{app.status.replaceAll('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <Badge variant={app.reviewState === 'REVIEWED' ? 'secondary' : 'outline'}>
                      {app.reviewState === 'REVIEWED' ? 'Reviewed' : 'Pending Review'}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="cursor-pointer text-xs text-muted-foreground"
                    onClick={() => navigate(`/applications/${app.id}`)}
                  >
                    {formatDate(app.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {applicationsQuery.isLoading ? 'Loading applications…' : 'No applications match your search/filter.'}
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
            itemCount={applications.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'LoanApplication' || l.entityType === 'Loan Applications')}
        title="Recent Activity — Loan Applications"
      />
    </div>
  );
}
