import * as React from 'react';
import { AlertCircle, Download, ExternalLink, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadFile, fetchFileBlob } from '@/lib/apiClient';

export interface LoanDocumentPreviewTarget {
  /** Full API path to the PDF, e.g. `/loan-accounts/:id/documents/:id/download` or `/loan-accounts/:id/statements-of-account/:id/download` — built by the caller, since Documents (ADR-051) and Statement of Account (ADR-052) live under different endpoints. */
  downloadPath: string;
  title: string;
  fileName: string;
}

/**
 * Inline PDF preview for a generated loan document (ADR-051) or Statement of Account (ADR-052),
 * mirroring `AttachmentPreviewModal`'s pattern. Both are always PDF (their download controllers
 * always set `Content-Type: application/pdf`), so unlike attachments there's no image/mime
 * branching needed here.
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
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let localUrl: string | null = null;
    setError(null);
    setObjectUrl(null);
    setLoading(true);
    fetchFileBlob(target.downloadPath)
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="min-w-0 flex-1 truncate">{target?.title}</DialogTitle>
            {objectUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={objectUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in new tab
                </a>
              </Button>
            )}
          </div>
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
            <iframe ref={iframeRef} src={objectUrl} className="h-[85vh] w-full rounded-md border" title={target.title} />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => iframeRef.current?.contentWindow?.print()}
              >
                <Printer className="mr-2 h-3.5 w-3.5" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadFile(target.downloadPath, target.fileName)}
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
