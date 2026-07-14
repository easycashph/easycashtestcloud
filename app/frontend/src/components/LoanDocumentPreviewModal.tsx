import * as React from 'react';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadFile, fetchFileBlob } from '@/lib/apiClient';

export interface LoanDocumentPreviewTarget {
  loanAccountId: string;
  generatedDocumentId: string;
  title: string;
  fileName: string;
}

/**
 * Inline PDF preview for a generated loan document (ADR-051), mirroring
 * `AttachmentPreviewModal`'s pattern. Generated loan documents are always PDF (the download
 * controller always sets `Content-Type: application/pdf`), so unlike attachments there's no
 * image/mime branching needed here.
 */
export function LoanDocumentPreviewModal({
  target,
  onClose,
}: {
  target: LoanDocumentPreviewTarget | null;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let localUrl: string | null = null;
    setError(null);
    setObjectUrl(null);
    setLoading(true);
    fetchFileBlob(`/loan-accounts/${target.loanAccountId}/documents/${target.generatedDocumentId}/download`)
      .then((blob) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this document for preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [target]);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{target?.title}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {!loading && !error && objectUrl && target && (
          <>
            <iframe src={objectUrl} className="h-[70vh] w-full rounded-md border" title={target.title} />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadFile(`/loan-accounts/${target.loanAccountId}/documents/${target.generatedDocumentId}/download`, target.fileName)}
              >
                <Download className="mr-2 h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
