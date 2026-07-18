import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Send, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient } from '@/lib/apiClient';
import type { ReminderTriggerType, SmsReminderLog, SmsReminderStatus } from '@/lib/smsReminderApiTypes';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 50;

const STATUS_OPTIONS: { value: SmsReminderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SENT', label: 'Sent (awaiting delivery report)' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'UNDELIVERED', label: 'Undelivered' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FAILED', label: 'Failed' },
];

/** Matches LoanDetailPage.tsx's REMINDER_TRIGGER_LABELS exactly - same 5-stage schedule, same wording. */
const TRIGGER_LABELS: Record<ReminderTriggerType, string> = {
  FIVE_DAYS_BEFORE: '5 Days Before',
  THREE_DAYS_BEFORE: '3 Days Before',
  ONE_DAY_BEFORE: '1 Day Before',
  DUE_DATE: 'Due Date',
  PAST_DUE_WEEKLY: 'Past Due (Weekly)',
};

const TRIGGER_OPTIONS: { value: ReminderTriggerType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All triggers' },
  { value: 'FIVE_DAYS_BEFORE', label: TRIGGER_LABELS.FIVE_DAYS_BEFORE },
  { value: 'THREE_DAYS_BEFORE', label: TRIGGER_LABELS.THREE_DAYS_BEFORE },
  { value: 'ONE_DAY_BEFORE', label: TRIGGER_LABELS.ONE_DAY_BEFORE },
  { value: 'DUE_DATE', label: TRIGGER_LABELS.DUE_DATE },
  { value: 'PAST_DUE_WEEKLY', label: TRIGGER_LABELS.PAST_DUE_WEEKLY },
];

const STATUS_BADGE: Record<SmsReminderStatus, { variant: 'outline' | 'success' | 'destructive'; label: string; icon: typeof Send }> = {
  SENT: { variant: 'outline', label: 'Sent', icon: Send },
  DELIVERED: { variant: 'success', label: 'Delivered', icon: CheckCircle2 },
  UNDELIVERED: { variant: 'destructive', label: 'Undelivered', icon: XCircle },
  REJECTED: { variant: 'destructive', label: 'Rejected', icon: XCircle },
  FAILED: { variant: 'destructive', label: 'Failed', icon: XCircle },
};

function getSortValue(log: SmsReminderLog, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'sentAt':
      return new Date(log.sentAt);
    case 'loanCode':
      return log.loanCode;
    case 'borrowerName':
      return log.borrowerName;
    case 'phoneNumber':
      return log.phoneNumber;
    case 'status':
      return log.status;
    case 'triggerType':
      return TRIGGER_LABELS[log.triggerType];
    case 'deliveredAt':
      return log.deliveredAt ? new Date(log.deliveredAt) : null;
    default:
      return undefined;
  }
}

/**
 * Reports Hub visibility for the Auto SMS Payment Reminders feature (2026-07-18) - who got
 * texted, when, and the M360 delivery outcome. Wired to the real backend (`GET
 * /sms-reminder-logs`). While SMS_ENABLED is false, this only ever shows manual test sends (see
 * `scripts/test-send-sms-reminder.ts`) - the automated daily job hasn't been turned on yet.
 */
export function SmsReminderLogsPage() {
  useLogPageView('SMS Reminder Logs');
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<SmsReminderStatus | 'ALL'>('ALL');
  const [triggerType, setTriggerType] = React.useState<ReminderTriggerType | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const logsQuery = useQuery({
    queryKey: ['sms-reminder-logs'],
    queryFn: () => apiClient.get<{ items: SmsReminderLog[] }>('/sms-reminder-logs'),
  });
  const logs = logsQuery.data?.items ?? [];

  const filtered = logs.filter((log) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      log.borrowerName.toLowerCase().includes(query) ||
      log.loanCode.toLowerCase().includes(query) ||
      log.phoneNumber.includes(query);
    const matchesStatus = status === 'ALL' || log.status === status;
    const matchesTrigger = triggerType === 'ALL' || log.triggerType === triggerType;
    return matchesSearch && matchesStatus && matchesTrigger;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'sentAt', direction: 'desc' });

  React.useEffect(() => {
    setPage(1);
  }, [search, status, triggerType, sort.key, sort.direction, logs.length]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const deliveredCount = logs.filter((l) => l.status === 'DELIVERED').length;
  const failedCount = logs.filter((l) => l.status === 'FAILED' || l.status === 'REJECTED' || l.status === 'UNDELIVERED').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">SMS Reminder Logs</h2>
        <p className="text-sm text-muted-foreground">
          {logs.length} reminder{logs.length === 1 ? '' : 's'} logged ({deliveredCount} delivered, {failedCount} failed/rejected/undelivered).
          Click a row to see the exact message sent.
        </p>
      </div>

      {logsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load SMS reminder logs. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap items-end gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label htmlFor="sms-logs-search" className="text-xs">
                Search
              </Label>
              <Input
                id="sms-logs-search"
                placeholder="Search borrower, loan code, or phone..."
                className="w-full sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-logs-status" className="text-xs">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SmsReminderStatus | 'ALL')}>
                <SelectTrigger id="sms-logs-status" className="w-full sm:w-64">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-logs-trigger" className="text-xs">
                Trigger
              </Label>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v as ReminderTriggerType | 'ALL')}>
                <SelectTrigger id="sms-logs-trigger" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortableTableHead sortKey="sentAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Sent At
                </SortableTableHead>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Loan Account
                </SortableTableHead>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Borrower
                </SortableTableHead>
                <SortableTableHead sortKey="phoneNumber" currentSort={sort} onSort={toggleSort}>
                  Phone
                </SortableTableHead>
                <SortableTableHead sortKey="triggerType" currentSort={sort} onSort={toggleSort}>
                  Trigger
                </SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
                <SortableTableHead sortKey="deliveredAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Delivered At
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((log) => {
                const isOpen = expanded.has(log.id);
                const badge = STATUS_BADGE[log.status];
                const StatusIcon = badge.icon;
                return (
                  <React.Fragment key={log.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(log.id)}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.sentAt)}</TableCell>
                      <TableCell
                        className="cursor-pointer font-mono text-xs hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/loans/${log.loanAccountId}`);
                        }}
                      >
                        {log.loanCode}
                      </TableCell>
                      <TableCell className="font-medium">{log.borrowerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.phoneNumber}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary">{TRIGGER_LABELS[log.triggerType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>
                          <span className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {badge.label}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.deliveredAt ? formatDateTime(log.deliveredAt) : '—'}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-secondary/30">
                          <div className="space-y-2 p-2 text-sm">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Message sent</p>
                              <p>{log.message}</p>
                            </div>
                            {log.providerTransId && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">M360 Transaction ID</p>
                                <p className="font-mono text-xs">{log.providerTransId}</p>
                              </div>
                            )}
                            {log.errorMessage && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Error</p>
                                <p className="text-destructive">{log.errorMessage}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {logsQuery.isLoading ? 'Loading…' : 'No SMS reminder logs match your filter.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8}>Total ({filtered.length} reminder{filtered.length === 1 ? '' : 's'})</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <PaginationControls
            pageNumber={currentPage}
            hasNext={currentPage < pageCount}
            hasPrev={currentPage > 1}
            onNext={() => setPage((p) => p + 1)}
            onPrev={() => setPage((p) => p - 1)}
            pageSize={PAGE_SIZE}
            itemCount={pageRows.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel label="SMS Reminder Logs" />
    </div>
  );
}
