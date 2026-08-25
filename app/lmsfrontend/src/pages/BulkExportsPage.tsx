import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  DatabaseZap,
  Download,
  FileArchive,
  Loader2,
  PackageOpen,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkExportDialog } from '@/components/BulkExportDialog';
import { DatabaseExportButton } from '@/components/DatabaseExportButton';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';
import { cn } from '@/lib/utils';
import type { BulkExportJob, BulkExportStatus, BulkExportType } from '@/lib/bulkExportApiTypes';
import { formatDateTime } from '@/lib/utils';

const EXPORT_TYPE_LABEL: Record<BulkExportType, string> = {
  BORROWER_ATTACHMENTS: 'Clients',
  LOAN_ACCOUNT_ATTACHMENTS: 'Loan Accounts',
  DATABASE_DUMP: 'Database',
};

const EXPORT_TYPE_ICON: Record<BulkExportType, React.ComponentType<{ className?: string }>> = {
  BORROWER_ATTACHMENTS: Users,
  LOAN_ACCOUNT_ATTACHMENTS: FileArchive,
  DATABASE_DUMP: DatabaseZap,
};

const POLL_INTERVAL_MS = 10_000;

const PILL_TRIGGER_CLASS =
  'rounded-full border-primary/20 bg-primary/5 px-4 text-primary hover:border-primary/40 hover:bg-primary/10';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_META: Record<BulkExportStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: 'Pending', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  PROCESSING: { label: 'Processing', dot: 'bg-accent animate-pulse', text: 'text-accent-foreground' },
  COMPLETED: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  FAILED: { label: 'Failed', dot: 'bg-destructive', text: 'text-destructive' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

function StatusPill({ status }: { status: BulkExportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.text)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      {meta.label}
      {status === 'PROCESSING' && '…'}
    </span>
  );
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
  const queryClient = useQueryClient();
  const { canUseBulkExport } = useRole();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  // 2026-08-25 (Cancel Export, user request, mocked up first): confirming inline in the row's own
  // action cell rather than a modal - matches this table's already-compact, scan-and-act feel, and
  // keeps the rest of the (possibly still-updating) table visible while deciding.
  const [confirmingCancelId, setConfirmingCancelId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

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

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.post(`/bulk-exports/${jobId}/cancel`, {}),
    onSuccess: () => {
      setConfirmingCancelId(null);
      setCancelError(null);
      void queryClient.invalidateQueries({ queryKey: ['bulk-export-jobs'] });
    },
    onError: (err) => {
      setConfirmingCancelId(null);
      setCancelError(err instanceof ApiError ? err.message : 'Could not cancel this export. Please try again.');
    },
  });

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
  const totalRequested = items.length;
  const totalCompleted = items.filter((j) => j.status === 'COMPLETED').length;
  const totalInProgress = items.filter((j) => j.status === 'PENDING' || j.status === 'PROCESSING').length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Requested', value: totalRequested },
          { label: 'Completed', value: totalCompleted },
          { label: 'In Progress', value: totalInProgress },
        ].map((stat) => (
          <Card key={stat.label} className="border-primary/10">
            <CardContent className="flex items-baseline justify-between p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</span>
              <span className="font-mono text-2xl font-semibold tabular-nums text-primary">{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a New Export</CardTitle>
          <CardDescription>Every export runs in the background and shows up below when ready.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <BulkExportDialog exportType="BORROWER_ATTACHMENTS" label="Download All Clients" triggerClassName={PILL_TRIGGER_CLASS} />
          <BulkExportDialog
            exportType="LOAN_ACCOUNT_ATTACHMENTS"
            label="Download All Loan Accounts"
            triggerClassName={PILL_TRIGGER_CLASS}
          />
          <DatabaseExportButton triggerClassName={PILL_TRIGGER_CLASS} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-muted-foreground" /> Export History
          </CardTitle>
          <CardDescription>{totalRequested} request{totalRequested === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {downloadError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {downloadError}
            </div>
          )}
          {cancelError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {cancelError}
            </div>
          )}

          {jobsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports requested yet - use one of the buttons above to start one.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Export</th>
                    <th className="px-3 py-2 font-medium">Date Range</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Records / Files</th>
                    <th className="px-3 py-2 text-right font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Requested</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((job) => {
                    const TypeIcon = EXPORT_TYPE_ICON[job.exportType];
                    return (
                      <tr key={job.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <TypeIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-medium">{EXPORT_TYPE_LABEL[job.exportType]}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {job.exportType === 'DATABASE_DUMP' ? '—' : `${job.startDate.slice(0, 10)} – ${job.endDate.slice(0, 10)}`}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={job.status} />
                          {job.status === 'FAILED' && job.errorMessage && (
                            <p className="mt-1 max-w-xs text-[11px] text-destructive">{job.errorMessage}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {job.exportType === 'DATABASE_DUMP' ? '—' : `${job.recordCount ?? '—'} / ${job.fileCount ?? '—'}`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {job.resultFileSize !== null ? formatFileSize(job.resultFileSize) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {job.status === 'COMPLETED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5"
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
                          {(job.status === 'PENDING' || job.status === 'PROCESSING') &&
                            (confirmingCancelId === job.id ? (
                              <div className="flex items-center justify-end gap-1.5 text-xs">
                                <span className="text-muted-foreground">Stop this export?</span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2.5"
                                  disabled={cancelMutation.isPending}
                                  onClick={() => cancelMutation.mutate(job.id)}
                                >
                                  {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, stop'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5"
                                  disabled={cancelMutation.isPending}
                                  onClick={() => setConfirmingCancelId(null)}
                                >
                                  Back
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  setCancelError(null);
                                  setConfirmingCancelId(job.id);
                                }}
                              >
                                <X className="mr-1.5 h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
