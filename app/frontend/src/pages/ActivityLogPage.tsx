import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useSortableTable } from '@/lib/useSortableTable';
import { useRole } from '@/lib/roleContext';
import { fetchAllPages } from '@/lib/apiClient';
import type { AuditLog } from '@/lib/auditLogApiTypes';
import { formatDateTime } from '@/lib/utils';

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
 * Wired to the real backend audit trail (`GET /audit-logs`) — every login and loan-application
 * decision recorded by the backend's `IAuditLogger`. Restricted to MIS, matching the backend
 * route's `requireRole('MIS')` gate (there's no branch dimension on the audit log table to scope
 * by, unlike every other list page in this app).
 */
export function ActivityLogPage() {
  const { canViewActivityLogs, currentAccount } = useRole();
  const [action, setAction] = React.useState<string>('ALL');

  const logsQuery = useQuery({
    queryKey: ['audit-logs', 'all'],
    queryFn: () => fetchAllPages<AuditLog>('/audit-logs'),
    enabled: canViewActivityLogs,
  });
  const logs = React.useMemo(() => logsQuery.data ?? [], [logsQuery.data]);

  const actionOptions = React.useMemo(() => ['ALL', ...[...new Set(logs.map((l) => l.action))].sort()], [logs]);
  const filtered = logs.filter((log) => action === 'ALL' || log.action === action);
  // Hooks must run unconditionally on every render — computed before the
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
          Real audit trail — user, action, exact date &amp; time, and affected entity. Currently records logins and loan
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
            <CardDescription>{filtered.length} of {logs.length} entries shown.</CardDescription>
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
                  <TableCell className="font-medium">{log.userName ?? '—'}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
