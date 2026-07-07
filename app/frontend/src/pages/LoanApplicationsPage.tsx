import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Lock, Mail, MailOpen, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import {
  logActivity,
  MOCK_ACTIVITY_LOGS,
  MOCK_LOAN_APPLICATIONS,
  type LoanApplicationReviewState,
  type LoanApplicationStatus,
  type MockLoanApplication,
  type MockRiskLevel,
} from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

function applicantInitials(name: string) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function getSortValue(app: MockLoanApplication, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'applicantName':
      return app.applicantName;
    case 'requestedCategory':
      return app.requestedCategory;
    case 'requestedAmount':
      return app.requestedAmount;
    case 'aiRisk':
      return app.aiRisk;
    case 'status':
      return app.status;
    case 'reviewState':
      return app.reviewState;
    case 'submittedAt':
      return new Date(app.submittedAt);
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

const RISK_BADGE_VARIANT: Record<MockRiskLevel, 'success' | 'warning' | 'destructive'> = {
  'Low Risk': 'success',
  'Medium Risk': 'warning',
  'High Risk': 'destructive',
};

const STATUS_BADGE_VARIANT: Record<LoanApplicationStatus, 'warning' | 'success' | 'destructive'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

const CATEGORY_OPTIONS = ['ALL', ...[...new Set(MOCK_LOAN_APPLICATIONS.map((a) => a.requestedCategory))].sort()];

/**
 * Represents applications that would arrive via API from the future public
 * Easycash loan-application website (not built yet — see
 * `docs/PROJECT_HANDOFF.md`). Everything here is local mock data; approving,
 * declining, or toggling review state only updates this browser tab's
 * in-memory state, per `src/lib/mockData.ts`'s `MOCK_LOAN_APPLICATIONS`
 * comment.
 *
 * `reviewState` (Reviewed/Unreviewed) is a separate email-inbox-style "seen"
 * flag, independent of the approve/decline decision — bulk toggle below
 * mirrors "mark as read/unread" over a selection or the whole inbox.
 */
export function LoanApplicationsPage() {
  const navigate = useNavigate();
  const { canAccessLoanApplications, currentAccount } = useRole();
  const applications = MOCK_LOAN_APPLICATIONS;
  const [, forceRerender] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<LoanApplicationStatus | 'ALL'>('ALL');
  const [category, setCategory] = React.useState('ALL');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  useLogPageView('Loan Applications');

  // Computed unconditionally, before the early return below, so
  // useSortableTable's hook call is never skipped on some renders.
  const filtered = applications.filter((app) => {
    const matchesStatus = status === 'ALL' || app.status === status;
    const matchesCategory = category === 'ALL' || app.requestedCategory === category;
    const query = search.trim().toLowerCase();
    const matchesSearch = query.length === 0 || app.applicantName.toLowerCase().includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'submittedAt', direction: 'desc' });

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

  const setReviewStateForSelected = (reviewState: LoanApplicationReviewState) => {
    for (const app of applications) {
      if (!selected.has(app.id) || app.reviewState === reviewState) continue;
      app.reviewState = reviewState;
      logActivity({
        userName: currentAccount.name,
        action: reviewState === 'REVIEWED' ? 'MARK_APPLICATION_REVIEWED' : 'MARK_APPLICATION_UNREVIEWED',
        entityType: 'LoanApplication',
        entityId: app.id,
        at: new Date().toISOString(),
      });
    }
    setSelected(new Set());
    forceRerender((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Loan Applications</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length} sample applications ({pendingCount} pending decision) — represents intake from the future public
            loan application website (not built yet). Not connected to any live system.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => navigate('/applications/new')} title="Encode a walk-in applicant's paper application (Form ECLC-LOFN01)">
          <FilePlus2 className="mr-2 h-4 w-4" /> Create Application
        </Button>
      </div>

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
                {CATEGORY_OPTIONS.map((c) => (
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
              disabled={selected.size === 0}
              onClick={() => setReviewStateForSelected('REVIEWED')}
            >
              <MailOpen className="mr-1.5 h-3.5 w-3.5" /> Mark as Reviewed
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setReviewStateForSelected('UNREVIEWED')}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Mark as Pending Review
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
                <SortableTableHead sortKey="aiRisk" currentSort={sort} onSort={toggleSort}>
                  AI Risk
                </SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Decision Status
                </SortableTableHead>
                <SortableTableHead sortKey="reviewState" currentSort={sort} onSort={toggleSort}>
                  Review
                </SortableTableHead>
                <SortableTableHead sortKey="submittedAt" currentSort={sort} onSort={toggleSort} isDateColumn>
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
                        <AvatarImage src={app.profilePictureUrl} alt={app.applicantName} />
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
                    <Badge variant={RISK_BADGE_VARIANT[app.aiRisk]}>{app.aiRisk}</Badge>
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
                    {formatDate(app.submittedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No sample applications match your search/filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'LoanApplication' || l.entityType === 'Loan Applications')}
        title="Recent Activity — Loan Applications"
      />
    </div>
  );
}
