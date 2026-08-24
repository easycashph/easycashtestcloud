import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, DatabaseZap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiClient } from '@/lib/apiClient';
import type { BulkExportJob } from '@/lib/bulkExportApiTypes';

/**
 * MIS "Export Database" trigger (2026-08-24 user request) - a full `pg_dump` of the production
 * database, zipped. No date range (a whole-database dump has no range concept) - just a confirm
 * step, since this is by far the most sensitive export on this page (every borrower's PII, every
 * loan's financial detail, not scoped to a date window at all).
 */
export function DatabaseExportButton() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => {
      const now = new Date().toISOString();
      return apiClient.post<BulkExportJob>('/bulk-exports', { exportType: 'DATABASE_DUMP', startDate: now, endDate: now });
    },
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
        if (!next) createMutation.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DatabaseZap className="mr-1.5 h-3.5 w-3.5" /> Export Database
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Database</DialogTitle>
          <DialogDescription>
            Generates a full snapshot of the production database (every borrower, loan, and transaction) as a downloadable ZIP. Runs in
            the background - you'll get a notification when it's ready. This contains sensitive data for the entire company - only
            download it somewhere secure.
          </DialogDescription>
        </DialogHeader>

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
          <Button size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {createMutation.isPending ? 'Starting…' : 'Start Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
