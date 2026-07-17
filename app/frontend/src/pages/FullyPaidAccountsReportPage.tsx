import * as React from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { downloadFile, ApiError } from '@/lib/apiClient';

/**
 * Real `.xlsx` download (`GET /reports/fully-paid.xlsx`) - a like-for-like replacement of the
 * legacy "Operation - Fully Paid Accounts" report. As-of-today snapshot, no date filter.
 */
export function FullyPaidAccountsReportPage() {
  useLogPageView('Fully Paid Accounts Report');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await downloadFile('/reports/fully-paid.xlsx', 'Fully Paid Accounts.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Fully Paid Accounts</h2>
        <p className="text-sm text-muted-foreground">Every loan settled in full (CLOSED), as of today.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download</CardTitle>
          <CardDescription>As-of-today snapshot - no date filter.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownload} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Preparing…' : 'Download report'}
          </Button>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Fully Paid Accounts Report" />
    </div>
  );
}
