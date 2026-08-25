import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/apiClient';
import type { BulkExportJob, BulkExportType } from '@/lib/bulkExportApiTypes';

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * MIS bulk document export trigger (2026-08-24 user request) - shared by ClientListPage and
 * LoanListPage, so the date-range dialog + submit logic lives in exactly one place. Kicks off a
 * background job (see ProcessBulkExportJobUseCase on the backend) and points MIS at "My Exports"
 * (the Notification bell also fires once it's ready) rather than blocking on the result here -
 * a wide date range can take minutes to prepare.
 */
export function BulkExportDialog({
  exportType,
  label,
  triggerClassName,
}: {
  exportType: BulkExportType;
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const queryClient = useQueryClient();

  const defaultRangeQuery = useQuery({
    queryKey: ['bulk-export-default-range', exportType],
    queryFn: () => apiClient.get<{ startDate: string; endDate: string }>(`/bulk-exports/default-range?exportType=${exportType}`),
    enabled: open,
  });

  React.useEffect(() => {
    if (defaultRangeQuery.data && !startDate && !endDate) {
      setStartDate(toDateInputValue(defaultRangeQuery.data.startDate));
      setEndDate(toDateInputValue(defaultRangeQuery.data.endDate));
    }
  }, [defaultRangeQuery.data, startDate, endDate]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<BulkExportJob>('/bulk-exports', {
        exportType,
        // Explicit "Z" (UTC), not local time - so the date the user typed/sees matches the date
        // stored server-side and shown back in "My Exports", with no timezone-shift-by-a-day.
        startDate: new Date(`${startDate}T00:00:00Z`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59Z`).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-export-jobs'] });
      setOpen(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStartDate('');
          setEndDate('');
          createMutation.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Packages every attachment for {exportType === 'BORROWER_ATTACHMENTS' ? 'client' : 'loan account'} records created within this
            date range into one ZIP. Runs in the background - you'll get a notification when it's ready, and it'll also show up under "My
            Exports".
          </DialogDescription>
        </DialogHeader>

        {defaultRangeQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading date range…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-export-start">Start date</Label>
              <Input id="bulk-export-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-export-end">End date</Label>
              <Input id="bulk-export-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}

        {createMutation.error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {createMutation.error instanceof Error ? createMutation.error.message : 'Could not start this export. Please try again.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!startDate || !endDate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {createMutation.isPending ? 'Starting…' : 'Start Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
