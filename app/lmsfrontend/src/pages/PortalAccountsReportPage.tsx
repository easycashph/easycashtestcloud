import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import type { PortalAccountReportRow } from '@/lib/reportApiTypes';
import { formatDate } from '@/lib/utils';

type StatusFilter = 'ALL' | PortalAccountReportRow['status'];

const STATUS_BADGE: Record<PortalAccountReportRow['status'], { label: string; variant: 'success' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING_VERIFICATION: { label: 'Pending Verification', variant: 'secondary' },
  DELETED: { label: 'Deleted', variant: 'destructive' },
};

/**
 * 2026-08-22 (user request): net-new report - no staff-facing "list all Portal Accounts" endpoint
 * existed before this (Portal Account data was previously only ever looked up one at a time).
 * Wired to `GET /reports/portal-accounts` (JSON) / `.xlsx` (export). Not branch-scoped, unlike
 * most other reports here - a Portal Account has no branch of its own until linked to a Borrower,
 * and the login itself isn't a per-branch concept - see the backend's own doc comment on
 * `IReportingRepository.getPortalAccountsReport`.
 */
export function PortalAccountsReportPage() {
  useLogPageView('Portal Accounts Report');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (status !== 'ALL') params.set('status', status);
    return params;
  }, [debouncedSearch, status]);

  const reportQuery = useQuery({
    queryKey: ['reports', 'portal-accounts', debouncedSearch, status],
    queryFn: () => apiClient.get<{ items: PortalAccountReportRow[] }>(`/reports/portal-accounts?${buildParams().toString()}`),
  });
  const rows = reportQuery.data?.items ?? [];

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const query = buildParams().toString();
      await downloadFile(`/reports/portal-accounts.xlsx${query ? `?${query}` : ''}`, 'Portal Accounts.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Portal Accounts</h2>
        <p className="text-sm text-muted-foreground">Every client self-service Portal account on file - name, status, and linked client record.</p>
      </div>

      {(reportQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search by name or email, or filter by account status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="w-64 pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleDownload} disabled={isDownloading} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download report'}
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="max-h-[600px] overflow-auto">
              <Table containerClassName="w-full" className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linked Client</TableHead>
                    <TableHead>Email Verified</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No portal accounts match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => {
                      const badge = STATUS_BADGE[r.status];
                      return (
                        <TableRow key={`${r.email}-${idx}`}>
                          <TableCell className="max-w-[200px] truncate font-medium" title={r.name}>
                            {r.name}
                            <div className="text-[11px] font-normal text-muted-foreground">{r.email}</div>
                          </TableCell>
                          <TableCell className="font-mono">{r.contactNumber ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className="text-[10px]">
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.linkedTo ? (
                              <span className="text-primary">{r.linkedTo}</span>
                            ) : (
                              <span className="text-muted-foreground">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>{r.emailVerifiedAt ? formatDate(r.emailVerifiedAt) : '—'}</TableCell>
                          <TableCell>{formatDate(r.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-background">
                    <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                      <TableCell colSpan={6}>
                        {rows.length} portal account{rows.length === 1 ? '' : 's'}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Portal Accounts Report" />
    </div>
  );
}
