import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, Eye, Loader2, Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AttachmentPreviewModal } from '@/components/AttachmentPreviewModal';
import { apiClient, downloadFile, uploadFile } from '@/lib/apiClient';
import {
  ATTACHMENT_ACCEPTED_MIME,
  ATTACHMENT_ACCEPTED_TYPES,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  DOCUMENT_CATEGORY_LABELS,
  type Attachment,
  type AttachmentOwnerType,
} from '@/lib/documentApiTypes';
import { formatDateTime } from '@/lib/utils';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable attachment list + upload widget — first wired for Loan Application intake
 * (`LoanApplicationDetailPage`), built generically against `AttachmentOwnerType` so
 * Borrower/LoanAccount detail pages can adopt it later without change.
 */
export function AttachmentsPanel({
  ownerType,
  ownerId,
  canUpload,
}: {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  canUpload: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const queryKey = ['attachments', ownerType, ownerId];
  const attachmentsQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.get<Attachment[]>(`/attachments?ownerType=${ownerType}&ownerId=${ownerId}`),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ownerType', ownerType);
      formData.append('ownerId', ownerId);
      return uploadFile<Attachment>('/attachments', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const handleDownload = async (attachment: Attachment) => {
    setLocalError(null);
    setDownloadingId(attachment.id);
    try {
      await downloadFile(`/attachments/${attachment.id}/download`, attachment.fileName);
    } catch {
      setLocalError('Could not download this file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    if (!ATTACHMENT_ACCEPTED_MIME.has(file.type)) {
      setLocalError('Unsupported file type. Allowed: PDF, JPEG, PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      setLocalError(`File exceeds the ${ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    uploadMutation.mutate(file);
  };

  const attachments = attachmentsQuery.data ?? [];
  const error = localError ?? (uploadMutation.error instanceof Error ? uploadMutation.error.message : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4 text-muted-foreground" /> Attachments
        </CardTitle>
        <CardDescription>Supporting documents (valid ID, payslip, CB report, etc.) — PDF, JPEG, or PNG, up to 10 MB each.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {attachmentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading attachments…</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {a.fileName}
                    {a.documentCategory && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-normal text-primary">
                        {DOCUMENT_CATEGORY_LABELS[a.documentCategory]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(a.fileSize)} · {a.uploadedByName ?? 'Unknown'} · {formatDateTime(a.uploadedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewAttachment(a)}
                    aria-label={`Preview ${a.fileName}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={downloadingId === a.id}
                    onClick={() => void handleDownload(a)}
                    aria-label={`Download ${a.fileName}`}
                  >
                    {downloadingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileSelected}
              disabled={uploadMutation.isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-2 h-3.5 w-3.5" />
              )}
              {uploadMutation.isPending ? 'Uploading…' : 'Upload attachment'}
            </Button>
          </div>
        )}
      </CardContent>
      <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </Card>
  );
}
