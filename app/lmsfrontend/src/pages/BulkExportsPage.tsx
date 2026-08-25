import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Download, Loader2, PackageOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BulkExportDialog } from '@/components/BulkExportDialog';
import { DatabaseExportButton } from '@/components/DatabaseExportButton';
import { apiClient, downloadFile } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';
import type { BulkExportJob, BulkExportStatus, BulkExportType } from '@/lib/bulkExportApiTypes';
import { formatDateTime } from '@/lib/utils';

const EXPORT_TYPE_LABEL: Record<BulkExportType, string> = {
  BORROWER_ATTACHMENTS: 'Clients',
  LOAN_ACCOUNT_ATTACHMENTS: 'Loan Accounts',
  DATABASE_DUMP: 'Database',
};

const POLL_INTERVAL_MS = 10_000;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: BulkExportStatus }) {
  if (status === 'COMPLETED') return <Badge variant="success">Completed</Badge>;
  if (status === 'FAILED') return <Badge variant="destructive">Failed</Badge>;
  if (status === 'PROCESSING') return <Badge variant="outline">Processing…</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

/**
 * Exports hub (2026-08-24 user request): every bulk export - client attachments, loan account
 * attachments, and a full database dump - lives here, reachable from Administration > System.
 * Gated on `bulk_export.use` (2026-08-24 follow-up: moved off a hardcoded MIS-only check onto the
 * DB-backed permission system) - MIS only by default, configurable from Roles & Permissions.
 * A completed export stays findable/re-downloadable here even if its
 * Notification bell entry was already missed or cleared. Polls while any job is still PENDING/
 * PROCESSING so the status updates without a manual refresh; stops polling once everything visible
 * has settled.
 */
export function BulkExportsPage() {
  const navigate = useNavigate();
  const { canUseBulkExport } = useRole();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['bulk-export-jobs'],
    queryFn: () => apiClient.get<{ items: BulkExportJob[] }>('/bulk-exports'),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const stillRunning = items.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING');
      return stillRunning ? POLL_INTERVAL_MS : false;
    },
  });

  const handleDownload = async (job: BulkExportJob) => {
    setDownloadError(null);
    setDownloadingId(job.id);
    try {
      await downloadFile(`/bulk-exports/${job.id}/download`, 'documents.zip');
    } catch {
      setDownloadError('Could not download this export. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!canUseBulkExport) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">You don't have access to Exports.</p>
      </div>
    );
  }

  const items = jobsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a New Export</CardTitle>
          <CardDescription>Every export runs in the background and shows up below when ready.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <BulkExportDialog exportType="BORROWER_ATTACHMENTS" label="Download All Clients" />
          <BulkExportDialog exportType="LOAN_ACCOUNT_ATTACHMENTS" label="Download All Loan Accounts" />
          <DatabaseExportButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-muted-foreground" /> Export History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {downloadError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {downloadError}
            </div>
          )}

          {jobsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports requested yet - use one of the buttons above to start one.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records / Files</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{EXPORT_TYPE_LABEL[job.exportType]}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.exportType === 'DATABASE_DUMP' ? '—' : `${job.startDate.slice(0, 10)} – ${job.endDate.slice(0, 10)}`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                        {job.status === 'FAILED' && job.errorMessage && (
                          <p className="mt-1 max-w-xs text-[11px] text-destructive">{job.errorMessage}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {job.exportType === 'DATABASE_DUMP' ? '—' : `${job.recordCount ?? '—'} / ${job.fileCount ?? '—'}`}
                      </TableCell>
                      <TableCell className="text-xs">{job.resultFileSize !== null ? formatFileSize(job.resultFileSize) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</TableCell>
                      <TableCell>
                        {job.status === 'COMPLETED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === job.id}
                            onClick={() => void handleDownload(job)}
                          >
                            {downloadingId === job.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
