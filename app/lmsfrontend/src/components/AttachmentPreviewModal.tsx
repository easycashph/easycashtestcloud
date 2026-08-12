import * as React from 'react';
import { AlertCircle, Download, ExternalLink, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadFile, fetchFileBlob } from '@/lib/apiClient';
import type { Attachment } from '@/lib/documentApiTypes';

/** `fileType` holds a real MIME type for attachments uploaded through the app (browser-supplied,
 * validated by UploadAttachmentUseCase's ALLOWED_MIME_TYPES), but a plain file extension
 * (".jpg", ".pdf") for rows backfilled from the legacy SDevTech export (scripts/
 * backfill-legacy-attachments.ts / migrate-legacy-data.ts), which only ever had SDevTech's own
 * extension to go on - both formats need to resolve to the same preview kind. */
function resolvePreviewKind(fileType: string): 'image' | 'pdf' | null {
  switch (fileType.toLowerCase()) {
    case 'application/pdf':
    case '.pdf':
      return 'pdf';
    case 'image/jpeg':
    case 'image/png':
    case '.jpg':
    case '.jpeg':
    case '.png':
      return 'image';
    default:
      return null;
  }
}

/**
 * Inline preview for an attachment (image or PDF) so reviewing a document no longer requires
 * downloading it first - download remains available inside the modal for a full/offline view.
 */
export function AttachmentPreviewModal({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

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

  const previewKind = attachment ? resolvePreviewKind(attachment.fileType) : null;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="min-w-0 flex-1 truncate">{attachment?.fileName}</DialogTitle>
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

        {!loading && !error && objectUrl && attachment && (
          <>
            {previewKind === 'pdf' ? (
              <>
                {/* 2026-08-09 (user request): same fix as LoanDocumentPreviewModal's own
                    2026-08-07 one - Chrome's built-in PDF viewer renders its OWN toolbar inside
                    this iframe (Print/Download/Save to Google Drive/etc.), whose Download button
                    bypasses downloadFile()'s naming convention entirely. #toolbar=0 hides that
                    built-in toolbar; the buttons below are the only way to print/download and
                    always behave correctly. */}
                <iframe
                  ref={iframeRef}
                  src={`${objectUrl}#toolbar=0`}
                  className="h-[85vh] w-full rounded-md border"
                  title={attachment.fileName}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => iframeRef.current?.contentWindow?.print()}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadFile(`/attachments/${attachment.id}/download`, attachment.fileName)}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </>
            ) : previewKind === 'image' ? (
              <img src={objectUrl} alt={attachment.fileName} className="mx-auto max-h-[85vh] w-auto rounded-md object-contain" />
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
