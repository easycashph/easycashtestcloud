import * as React from 'react';
import { AlertCircle, Lock, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { useSortableTable } from '@/lib/useSortableTable';
import { useRole } from '@/lib/roleContext';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { AuditLog } from '@/lib/auditLogApiTypes';
import { useLogPageView } from '@/lib/activityLog';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 100;

function getSortValue(log: AuditLog, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'createdAt':
      return new Date(log.createdAt);
    case 'userName':
      return log.userName ?? '';
    case 'action':
      return log.action;
    case 'entityType':
      return log.entityType;
    case 'entityId':
      return log.entityId;
    default:
      return undefined;
  }
}

const ACTION_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'outline' | 'destructive'> = {
  LOGIN: 'outline',
  SUBMIT_LOAN_APPLICATION: 'secondary',
  APPROVE_LOAN: 'success',
  ACTIVATE_LOAN: 'success',
  RECORD_PAYMENT: 'default',
  APPROVE_LOAN_APPLICATION: 'success',
  DECLINE_LOAN_APPLICATION: 'destructive',
  REVERT_LOAN_APPLICATION_DECISION: 'warning',
  MARK_APPLICATION_REVIEWED: 'outline',
};

/**
 * Wired to the real backend audit trail (`GET /audit-logs`) - every login and loan-application
 * decision recorded by the backend's `IAuditLogger`. Restricted to MIS, matching the backend
 * route's `requireRole('MIS')` gate (there's no branch dimension on the audit log table to scope
 * by, unlike every other list page in this app).
 */
export function ActivityLogPage() {
  useLogPageView('Activity Logs');
  const { canViewActivityLogs, currentAccount } = useRole();
  const [action, setAction] = React.useState<string>('ALL');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  // 2026-07-23 (user request) - clicking a user's name in the table below filters the whole list
  // down to just that person's activity, server-side (not just this page's 100 rows) - cleared via
  // the chip's "x" or by starting a new text search.
  const [userFilter, setUserFilter] = React.useState<{ id: string; name: string } | null>(null);

  const {
    items: logs,
    query: logsQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<AuditLog>(
    ['audit-logs'],
    '/audit-logs',
    { search: debouncedSearch, userId: userFilter?.id },
    PAGE_SIZE,
    canViewActivityLogs,
  );

  const actionOptions = React.useMemo(() => ['ALL', ...[...new Set(logs.map((l) => l.action))].sort()], [logs]);
  const filtered = logs.filter((log) => action === 'ALL' || log.action === action);
  // Hooks must run unconditionally on every render - computed before the
  // early return below, even though its output is unused on that path.
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'createdAt', direction: 'desc' });

  if (!canViewActivityLogs) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Activity Logs</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Activity Logs</h2>
        <p className="text-sm text-muted-foreground">
          Real audit trail - user, action, exact date &amp; time, and affected entity. Currently records logins and loan
          application decisions; more actions will be logged as their modules are wired.
        </p>
      </div>

      {logsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load activity logs. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Recorded Actions</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>{filtered.length} of {logs.length} entries on this page.</span>
              {userFilter && (
                <Badge variant="secondary" className="gap-1">
                  {userFilter.name}
                  <button
                    type="button"
                    onClick={() => setUserFilter(null)}
                    aria-label={`Clear filter for ${userFilter.name}`}
                    className="rounded-full hover:bg-black/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user, action, entity..."
                className="w-full pl-8 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === 'ALL' ? 'All actions' : a.replaceAll('_', ' ')}
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
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Date &amp; Time
                </SortableTableHead>
                <SortableTableHead sortKey="userName" currentSort={sort} onSort={toggleSort}>
                  User
                </SortableTableHead>
                <SortableTableHead sortKey="action" currentSort={sort} onSort={toggleSort}>
                  Action
                </SortableTableHead>
                <SortableTableHead sortKey="entityType" currentSort={sort} onSort={toggleSort}>
                  Entity Type
                </SortableTableHead>
                <SortableTableHead sortKey="entityId" currentSort={sort} onSort={toggleSort}>
                  Affected Entity
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell className="font-medium">
                    {log.userId && log.userName ? (
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => setUserFilter({ id: log.userId!, name: log.userName! })}
                        title={`Show all activity for ${log.userName}`}
                      >
                        {log.userName}
                      </button>
                    ) : (
                      (log.userName ?? '-')
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[log.action] ?? 'outline'}>{log.action.replaceAll('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.entityType}</TableCell>
                  <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {logsQuery.isLoading ? 'Loading…' : 'No log entries for this filter.'}
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
            itemCount={logs.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}
