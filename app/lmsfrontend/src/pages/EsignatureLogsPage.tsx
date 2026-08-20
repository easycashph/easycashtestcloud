import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Mail, MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView, logActivity } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient } from '@/lib/apiClient';
import type { SigningNotificationLog } from '@/lib/signingNotificationLogApiTypes';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 50;

type SigningType = SigningNotificationLog['type'];
type SigningChannel = 'SMS' | 'EMAIL' | 'PORTAL';
type SigningParty = SigningNotificationLog['partyType'];

const TYPE_OPTIONS: { value: SigningType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All types' },
  { value: 'LINK', label: 'Signing link' },
  { value: 'OTP', label: 'OTP code' },
];

const CHANNEL_OPTIONS: { value: SigningChannel | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All channels' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PORTAL', label: 'Portal' },
];

const PARTY_OPTIONS: { value: SigningParty | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All parties' },
  { value: 'BORROWER', label: 'Borrower' },
  { value: 'CO_BORROWER', label: 'Co-Borrower' },
];

const TYPE_BADGE: Record<SigningType, { variant: 'secondary' | 'outline'; label: string }> = {
  LINK: { variant: 'secondary', label: 'Link' },
  OTP: { variant: 'outline', label: 'OTP' },
};

function getSortValue(log: SigningNotificationLog, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'sentAt':
      return new Date(log.sentAt);
    case 'type':
      return log.type;
    case 'channel':
      return log.channel;
    case 'loanCode':
      return log.loanCode;
    case 'borrowerName':
      return log.borrowerName;
    case 'partyType':
      return log.partyType;
    case 'recipient':
      return log.recipient;
    case 'verifiedAt':
      return log.verifiedAt ? new Date(log.verifiedAt) : null;
    default:
      return undefined;
  }
}

/**
 * 2026-07-29 (user request): "may OTP sms and email log ba tayo? proof na send sa borrower and
 * co-borrower ang OTP via sms or email?" - previously neither the signing-link send nor the OTP
 * send left any queryable record. Centralized here (Reports Hub, same placement as Reminder Logs)
 * rather than inline on the Loan Detail page, per the user's own suggestion, to avoid cluttering
 * that page and to make it searchable across every loan in one place.
 */
export function EsignatureLogsPage() {
  useLogPageView('E-signature Logs');
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<SigningType | 'ALL'>('ALL');
  const [channel, setChannel] = React.useState<SigningChannel | 'ALL'>('ALL');
  const [partyType, setPartyType] = React.useState<SigningParty | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  const logsQuery = useQuery({
    queryKey: ['signing-notification-logs'],
    queryFn: () => apiClient.get<{ items: SigningNotificationLog[] }>('/signing-notification-logs'),
  });
  const logs = logsQuery.data?.items ?? [];

  const filtered = logs.filter((log) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      log.borrowerName.toLowerCase().includes(query) ||
      log.loanCode.toLowerCase().includes(query) ||
      log.recipient.toLowerCase().includes(query);
    const matchesType = type === 'ALL' || log.type === type;
    const matchesChannel = channel === 'ALL' || log.channel === channel;
    const matchesParty = partyType === 'ALL' || log.partyType === partyType;
    return matchesSearch && matchesType && matchesChannel && matchesParty;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'sentAt', direction: 'desc' });

  React.useEffect(() => {
    setPage(1);
  }, [search, type, channel, partyType, sort.key, sort.direction, logs.length]);

  // 2026-07-30 (user request): log a specific "filtered by X" activity entry, debounced so typing
  // in Search doesn't fire one write per keystroke - skips the initial mount (already covered by
  // useLogPageView above) and skips logging when every filter is back to its default (nothing
  // meaningful to record).
  const filterDescription = React.useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(search.trim());
    if (type !== 'ALL') parts.push(TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type);
    if (channel !== 'ALL') parts.push(CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel);
    if (partyType !== 'ALL') parts.push(PARTY_OPTIONS.find((o) => o.value === partyType)?.label ?? partyType);
    return parts.join(', ');
  }, [search, type, channel, partyType]);

  const isFirstFilterRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    if (!filterDescription) return;
    const timeout = setTimeout(() => {
      logActivity('E-signature Logs', 'FILTER_SECTION', filterDescription);
    }, 800);
    return () => clearTimeout(timeout);
  }, [filterDescription]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const linkCount = logs.filter((l) => l.type === 'LINK').length;
  const otpCount = logs.filter((l) => l.type === 'OTP').length;
  const verifiedCount = logs.filter((l) => l.verifiedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">E-signature Logs</h2>
        <p className="text-sm text-muted-foreground">
          {logs.length} notification{logs.length === 1 ? '' : 's'} logged ({linkCount} link{linkCount === 1 ? '' : 's'}, {otpCount} OTP
          {otpCount === 1 ? '' : 's'}, {verifiedCount} verified). Every signing link and OTP code sent, across every loan.
        </p>
      </div>

      {logsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load e-signature logs. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap items-end gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label htmlFor="esig-logs-search" className="text-xs">
                Search
              </Label>
              <Input
                id="esig-logs-search"
                placeholder="Search borrower, loan code, phone, or email..."
                className="w-full sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="esig-logs-type" className="text-xs">
                Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as SigningType | 'ALL')}>
                <SelectTrigger id="esig-logs-type" className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="esig-logs-channel" className="text-xs">
                Channel
              </Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as SigningChannel | 'ALL')}>
                <SelectTrigger id="esig-logs-channel" className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="esig-logs-party" className="text-xs">
                Party
              </Label>
              <Select value={partyType} onValueChange={(v) => setPartyType(v as SigningParty | 'ALL')}>
                <SelectTrigger id="esig-logs-party" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_OPTIONS.map((option) => (
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
                <SortableTableHead sortKey="sentAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Sent At
                </SortableTableHead>
                <SortableTableHead sortKey="type" currentSort={sort} onSort={toggleSort}>
                  Type
                </SortableTableHead>
                <SortableTableHead sortKey="channel" currentSort={sort} onSort={toggleSort}>
                  Channel
                </SortableTableHead>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Loan Account
                </SortableTableHead>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Borrower
                </SortableTableHead>
                <SortableTableHead sortKey="partyType" currentSort={sort} onSort={toggleSort}>
                  Party
                </SortableTableHead>
                <SortableTableHead sortKey="recipient" currentSort={sort} onSort={toggleSort}>
                  Sent To
                </SortableTableHead>
                <SortableTableHead sortKey="verifiedAt" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((log) => {
                const typeBadge = TYPE_BADGE[log.type];
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.sentAt)}</TableCell>
                    <TableCell>
                      <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <span className="flex items-center gap-1">
                          {log.channel === 'EMAIL' ? <Mail className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
                          {log.channel === 'EMAIL' ? 'Email' : 'SMS'}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="cursor-pointer font-mono text-xs hover:underline"
                      onClick={() => {
                        logActivity('E-signature Logs', 'OPEN_SIGNING_LOG', log.loanCode);
                        navigate(`/loans/${log.loanAccountId}`);
                      }}
                    >
                      {log.loanCode}
                    </TableCell>
                    <TableCell className="font-medium">{log.borrowerName}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary">{log.partyType === 'CO_BORROWER' ? 'Co-Borrower' : 'Borrower'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.recipient}</TableCell>
                    <TableCell>
                      {log.verifiedAt ? (
                        <Badge variant="success">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sent</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!logsQuery.isLoading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No e-signature notifications logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8}>Total ({filtered.length} notification{filtered.length === 1 ? '' : 's'})</TableCell>
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

      <RecentActivityPanel label="E-signature Logs" limit={10} />
    </div>
  );
}
