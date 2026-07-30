import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ConcurrencyConflictField {
  label: string;
  before: string;
  after: string;
}

/**
 * 2026-07-22 (optimistic concurrency, phase 1 - LoanAccount edit) - shown when a save would
 * silently overwrite a change someone else made to the same record while this form was open.
 * Reusable across every editable-record form; each caller supplies its own field diff and wires
 * `onReload`/`onOverwrite` to its own mutation state.
 *
 * Deliberately does not attribute the change to a specific person or timestamp - the entity
 * itself doesn't track "last edited by" generically, and fabricating that would violate
 * CLAUDE.md's "never fabricate" rule. If a future entity does track it, pass it in as an
 * additional prop rather than guessing here.
 */
export function ConcurrencyConflictDialog({
  open,
  onOpenChange,
  changedFields,
  onReload,
  onOverwrite,
  overwritePending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changedFields: ConcurrencyConflictField[];
  onReload: () => void;
  onOverwrite: () => void;
  overwritePending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle>This record changed while you were editing</DialogTitle>
              <DialogDescription>
                Someone else updated this record just now. Saving would overwrite their change.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {changedFields.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">What changed</p>
            <dl className="space-y-1.5 text-sm">
              {changedFields.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="text-right">
                    <span className="text-muted-foreground line-through">{f.before}</span>{' '}
                    <span className="text-primary">→ {f.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="text-sm text-muted-foreground">Your unsaved changes are still here. Choose how to proceed.</p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="outline" className="w-full justify-start" onClick={onReload}>
            <RotateCcw className="mr-2 h-4 w-4" />
            <span className="text-left">
              <span className="block font-medium">Reload the latest version</span>
              <span className="block text-xs font-normal text-muted-foreground">Discards your unsaved edits</span>
            </span>
          </Button>
          <Button variant="destructive" className="w-full justify-start" onClick={onOverwrite} disabled={overwritePending}>
            <span className="text-left">
              <span className="block font-medium">{overwritePending ? 'Saving…' : 'Save anyway (overwrite)'}</span>
              <span className="block text-xs font-normal opacity-85">The change above will be lost</span>
            </span>
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel and keep editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
