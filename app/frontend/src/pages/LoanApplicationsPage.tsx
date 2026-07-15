import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FilePlus2, Lock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { RoleAbbr } from '@/components/RoleAbbr';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { LoanApplication, LoanApplicationStatus } from '@/lib/loanApplicationApiTypes';
import { LoanApplicationForm } from '@/pages/LoanApplicationCreatePage';
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
    case 'createdAt':
      return new Date(app.createdAt);
    default:
      return undefined;
  }
}

const STATUS_OPTIONS: { value: LoanApplicationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PREAPPROVED', label: 'Pre-approved' },
  { value: 'PREDECLINED', label: 'Pre-declined' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DECLINED', label: 'Declined' },
];

const STATUS_BADGE_VARIANT: Record<LoanApplicationStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PREAPPROVED: 'secondary',
  PREDECLINED: 'warning',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

/**
 * Wired to the real backend Loan Applications module (`GET /loan-applications`). Every application
 * is system-classified PREAPPROVED/PREDECLINED at creation (and re-classified whenever the Detail
 * page's Risk Management Summary is saved) by the backend's LoanApplicationPreQualificationService
 * - advisory only; the officer still makes the real APPROVED/DECLINED call from the Detail page.
 *
 * Real, server-side pagination (100 rows/page - see `useCursorPagination`) replaced loading every
 * application up front. Applicant-name search goes to the backend's `?search=` param (debounced);
 * status and category have no backend filter param yet, so those two narrow within the current page
 * only, not across every application.
 */
export function LoanApplicationsPage() {
  const navigate = useNavigate();
  const { canAccessLoanApplications, currentAccount } = useRole();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = React.useState<LoanApplicationStatus | 'ALL'>('ALL');
  const [category, setCategory] = React.useState('ALL');
  const [createOpen, setCreateOpen] = React.useState(false);

  useLogPageView('List of Loan Applications');

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
          <h2 className="text-2xl font-semibold tracking-tight">List of Loan Applications</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Restricted to <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, and <RoleAbbr role="CRM" /> accounts
            </p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}) - this
              role does not have access to Loan Applications.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === 'PREAPPROVED' || a.status === 'PREDECLINED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">List of Loan Applications</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length} application{applications.length === 1 ? '' : 's'} on this page ({pendingCount} pending decision) -
            intake, review, and decision workflow, wired to the live backend.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateOpen(true)} title="Encode a walk-in applicant's paper application (Form ECLC-LOFN01)">
          <FilePlus2 className="mr-2 h-4 w-4" /> Create Loan Applicant Profile
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Application Form</DialogTitle>
            <DialogDescription>
              For walk-in applicants - the loan officer fills this out on the applicant&apos;s behalf, following the official paper
              form (Form No. <span className="font-mono">ECLC-LOFN01</span>, Rev 02).
            </DialogDescription>
          </DialogHeader>
          {createOpen && (
            <LoanApplicationForm
              showChrome={false}
              onCreated={(application, failedDocumentLabels) => {
                setCreateOpen(false);
                navigate(`/applications/${application.id}`, {
                  state: failedDocumentLabels ? { failedDocumentLabels } : undefined,
                });
              }}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Submitted
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <div className="flex items-center gap-2">
                      <ApplicantAvatar
                        ownerType="LOAN_APPLICATION"
                        ownerId={app.id}
                        initials={applicantInitials(app.applicantName)}
                        className="h-7 w-7"
                        fallbackClassName="text-xs"
                      />
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
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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

      <RecentActivityPanel label="List of Loan Applications" entityTypes={['LoanApplication', 'Loan Applications']} />
    </div>
  );
}
