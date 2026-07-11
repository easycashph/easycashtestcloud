import * as React from 'react';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadFile, fetchFileBlob } from '@/lib/apiClient';
import type { Attachment } from '@/lib/documentApiTypes';

const PREVIEWABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

/**
 * Inline preview for an attachment (image or PDF) so reviewing a document no longer requires
 * downloading it first — download remains available inside the modal for a full/offline view.
 */
export function AttachmentPreviewModal({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!attachment) return;
    let cancelled = false;
    let localUrl: string | null = null;
    setError(null);
    setObjectUrl(null);
    setLoading(true);
    fetchFileBlob(`/attachments/${attachment.id}/download`)
      .then((blob) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this file for preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [attachment]);

  const previewable = attachment ? PREVIEWABLE_MIME_TYPES.has(attachment.fileType) : false;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment?.fileName}</DialogTitle>
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

        {!loading && !error && objectUrl && attachment && (
          <>
            {attachment.fileType === 'application/pdf' ? (
              <iframe src={objectUrl} className="h-[70vh] w-full rounded-md border" title={attachment.fileName} />
            ) : previewable ? (
              <img src={objectUrl} alt={attachment.fileName} className="mx-auto max-h-[70vh] w-auto rounded-md object-contain" />
            ) : (
              <div className="space-y-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void downloadFile(`/attachments/${attachment.id}/download`, attachment.fileName)}
                >
                  <Download className="mr-2 h-3.5 w-3.5" /> Download instead
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
