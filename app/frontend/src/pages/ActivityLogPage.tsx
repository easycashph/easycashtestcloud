import * as React from 'react';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRole } from '@/lib/roleContext';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDateTime } from '@/lib/utils';

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
  MARK_APPLICATION_UNREVIEWED: 'outline',
};

/**
 * Every user action in this preview is logged (logins, loan/application
 * decisions, payments, review-state toggles) — per this checkpoint's
 * instruction that all activity must be recorded with date AND time, not
 * just a date. Full details are restricted to MIS and Loan Operation
 * Manager; other roles get an access-denied view, matching the pattern
 * already used for Loan Applications/LMS Members.
 */
export function ActivityLogPage() {
  const { canViewActivityLogs, currentAccount } = useRole();
  const [action, setAction] = React.useState<string>('ALL');
  const actionOptions = ['ALL', ...[...new Set(MOCK_ACTIVITY_LOGS.map((l) => l.action))].sort()];

  if (!canViewActivityLogs) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Activity Logs</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS and Loan Operation Manager accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = MOCK_ACTIVITY_LOGS.filter((log) => action === 'ALL' || log.action === action);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Activity Logs</h2>
        <p className="text-sm text-muted-foreground">
          Static/mock entries illustrating what a real audit trail would record — user, action, exact date &amp; time, and affected
          entity.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Recorded Actions</CardTitle>
            <CardDescription>{filtered.length} of {MOCK_ACTIVITY_LOGS.length} entries shown.</CardDescription>
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
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Affected Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.at)}</TableCell>
                  <TableCell className="font-medium">{log.userName}</TableCell>
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
                    No log entries for this filter.
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
